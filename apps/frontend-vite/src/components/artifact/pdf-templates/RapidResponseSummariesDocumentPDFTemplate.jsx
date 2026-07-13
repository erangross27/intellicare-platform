/** Canonical LETTER export for rapid_response_summaries. */
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
  { title: 'Response Details', fields: ['responseTimeMinutes', 'triggerCriteria', 'glasgowComaScore'] },
  { title: 'Vital Signs', fields: ['systolicBloodPressure', 'diastolicBloodPressure', 'meanArterialPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation', 'coreTemperature', 'fractionalInspiredOxygen'] },
  { title: 'Cardiac and Respiratory', fields: ['cardiacRhythm', 'ventilationSupport'] },
  { title: 'Lab Values', fields: ['lactateLevel', 'bloodGlucose'] },
  { title: 'Clinical Scoring', fields: ['mewsScore', 'newsScore', 'qsofaScore'] },
  { title: 'Interventions', fields: ['primaryInterventions', 'vasoactiveAgents', 'fluidResuscitationVolume'] },
  { title: 'Disposition and Outcome', fields: ['dispositionDecision', 'icuTransferRequired', 'codeBlueProgression'] },
];

const FIELD_LABELS = {
  responseTimeMinutes: 'Response Time', triggerCriteria: 'Trigger Criteria', glasgowComaScore: 'Glasgow Coma Score',
  systolicBloodPressure: 'Systolic Blood Pressure', diastolicBloodPressure: 'Diastolic Blood Pressure', meanArterialPressure: 'Mean Arterial Pressure',
  heartRate: 'Heart Rate', respiratoryRate: 'Respiratory Rate', oxygenSaturation: 'Oxygen Saturation', coreTemperature: 'Core Temperature', fractionalInspiredOxygen: 'FiO2',
  cardiacRhythm: 'Cardiac Rhythm', ventilationSupport: 'Ventilation Support', lactateLevel: 'Lactate Level', bloodGlucose: 'Blood Glucose',
  mewsScore: 'MEWS Score', newsScore: 'NEWS Score', qsofaScore: 'qSOFA Score', primaryInterventions: 'Primary Interventions', vasoactiveAgents: 'Vasoactive Agents',
  fluidResuscitationVolume: 'Fluid Resuscitation Volume', dispositionDecision: 'Disposition Decision', icuTransferRequired: 'ICU Transfer Required', codeBlueProgression: 'Code Blue Progression',
};

const FIELD_UNITS = {
  responseTimeMinutes: 'minutes', systolicBloodPressure: 'mmHg', diastolicBloodPressure: 'mmHg', meanArterialPressure: 'mmHg',
  heartRate: 'bpm', respiratoryRate: 'breaths/min', oxygenSaturation: '%', coreTemperature: 'C', fractionalInspiredOxygen: '%',
  lactateLevel: 'mmol/L', bloodGlucose: 'mg/dL', fluidResuscitationVolume: 'mL',
};

const MEANINGFUL_ZERO_FIELDS = ['mewsScore', 'newsScore', 'qsofaScore', 'fluidResuscitationVolume'];
const BOOLEAN_FIELDS = ['icuTransferRequired', 'codeBlueProgression'];
const NUMBER_FIELDS = ['responseTimeMinutes', 'glasgowComaScore', 'systolicBloodPressure', 'diastolicBloodPressure', 'meanArterialPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation', 'coreTemperature', 'fractionalInspiredOxygen', 'lactateLevel', 'bloodGlucose', 'mewsScore', 'newsScore', 'qsofaScore', 'fluidResuscitationVolume'];
const ARRAY_FIELDS = ['primaryInterventions', 'vasoactiveAgents'];
const COMMA_SPLIT_FIELDS = ['triggerCriteria'];

const hasFieldValue = (field, value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return value !== 0 || MEANINGFUL_ZERO_FIELDS.includes(field);
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'object' ? Object.keys(value).length > 0 : true;
};

const safeString = (value) => String(value ?? '')
  .replace(/\u00d7/g, 'x')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2013\u2014]/g, '-');

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

const fieldRows = (field, value) => {
  if (BOOLEAN_FIELDS.includes(field)) return [{ type: 'item', value: value ? 'Yes' : 'No' }];
  if (NUMBER_FIELDS.includes(field)) {
    const unit = FIELD_UNITS[field];
    return [{ type: 'item', value: unit ? `${value} ${unit}` : String(value) }];
  }
  if (ARRAY_FIELDS.includes(field)) return value.map(item => ({ type: 'item', value: safeString(item) }));
  const text = safeString(value);
  if (COMMA_SPLIT_FIELDS.includes(field)) return splitByComma(text).map(item => ({ type: 'item', value: item }));
  return splitBySentence(text).flatMap(sentence => {
    const parsed = parseLabel(sentence);
    if (!parsed.isLabeled) return [{ type: 'item', value: sentence }];
    return [
      { type: 'subtitle', value: parsed.label },
      ...splitByComma(parsed.value).map(item => ({ type: 'item', value: item })),
    ];
  });
};

const renderField = (field, value) => {
  if (!hasFieldValue(field, value)) return null;
  const rows = fieldRows(field, value);
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
    if (record?.rapid_response_summaries) return Array.isArray(record.rapid_response_summaries) ? record.rapid_response_summaries : [record.rapid_response_summaries];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.rapid_response_summaries) return Array.isArray(nested.rapid_response_summaries) ? nested.rapid_response_summaries : [nested.rapid_response_summaries];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const RapidResponseSummariesDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}>
          <Text style={styles.documentTitle}>Rapid Response Summaries</Text>
        </View>
        {!records.length ? <Text style={styles.noDataText}>No data available</Text> : null}
        {records.map((record, recordIndex) => {
          const populatedSections = SECTION_CONFIGS.map(config => ({
            title: config.title,
            fields: config.fields.map(field => renderField(field, record[field])),
          })).filter(config => config.fields.some(Boolean));
          const recordTitle = `Rapid Response Summary ${recordIndex + 1}`;
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

export default RapidResponseSummariesDocumentPDFTemplate;
