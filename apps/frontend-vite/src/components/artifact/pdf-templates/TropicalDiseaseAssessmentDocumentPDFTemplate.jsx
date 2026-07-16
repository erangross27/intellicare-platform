/** Tropical Disease Assessment - canonical box-free PDF. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.35, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginTop: 6, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 2, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.35, marginBottom: 0, paddingLeft: 8 },
  noDataText: { fontSize: 14, marginTop: 40 },
});

const SECTION_TITLES = {
  'travel-history': 'Travel History',
  'vector-exposure': 'Vector and Prophylaxis',
  'fever-presentation': 'Fever Presentation',
  parasitology: 'Parasitology',
  serology: 'Serology',
  'clinical-findings': 'Clinical Findings',
  treatment: 'Treatment',
  complications: 'Complications',
  'public-health': 'Public Health',
};

const FIELD_LABELS = {
  date: 'Assessment Date',
  travelHistoryCountries: 'Travel History Countries',
  travelStartDate: 'Travel Start Date',
  travelReturnDate: 'Travel Return Date',
  exposureHistory: 'Exposure History',
  vectorExposure: 'Vector Exposure',
  prophylaxisCompliance: 'Prophylaxis Compliance',
  vaccinationStatus: 'Vaccination Status',
  feverOnsetDate: 'Fever Onset Date',
  feverPattern: 'Fever Pattern',
  peakTemperature: 'Peak Temperature',
  suspectedPathogen: 'Suspected Pathogen',
  parasitologyResults: 'Parasitology Results',
  malariaSpecies: 'Malaria Species',
  parasitemia: 'Parasitemia',
  rapidDiagnosticTest: 'Rapid Diagnostic Test',
  serologyResults: 'Serology Results',
  hepatosplenomegaly: 'Hepatosplenomegaly',
  rashCharacteristics: 'Rash Characteristics',
  neurologicSymptoms: 'Neurologic Symptoms',
  hemorrhagicManifestations: 'Hemorrhagic Manifestations',
  antimicrobialTherapy: 'Antimicrobial Therapy',
  treatmentResponse: 'Treatment Response',
  complicationsDeveloped: 'Complications Developed',
  isolationRequired: 'Isolation Required',
  publicHealthNotification: 'Public Health Notification',
};

const SECTION_FIELDS = {
  'travel-history': ['date', 'travelHistoryCountries', 'travelStartDate', 'travelReturnDate', 'exposureHistory'],
  'vector-exposure': ['vectorExposure', 'prophylaxisCompliance', 'vaccinationStatus'],
  'fever-presentation': ['feverOnsetDate', 'feverPattern', 'peakTemperature', 'suspectedPathogen'],
  parasitology: ['parasitologyResults', 'malariaSpecies', 'parasitemia', 'rapidDiagnosticTest'],
  serology: ['serologyResults'],
  'clinical-findings': ['hepatosplenomegaly', 'rashCharacteristics', 'neurologicSymptoms', 'hemorrhagicManifestations'],
  treatment: ['antimicrobialTherapy', 'treatmentResponse'],
  complications: ['complicationsDeveloped'],
  'public-health': ['isolationRequired', 'publicHealthNotification'],
};

const DATE_FIELDS = new Set(['date', 'travelStartDate', 'travelReturnDate', 'feverOnsetDate']);
const NUMBER_FIELDS = new Set(['peakTemperature', 'parasitemia']);
const BOOLEAN_FIELDS = new Set(['hepatosplenomegaly', 'hemorrhagicManifestations', 'isolationRequired', 'publicHealthNotification']);
const ARRAY_FIELDS = new Set(['travelHistoryCountries', 'vectorExposure', 'neurologicSymptoms', 'complicationsDeveloped']);
const COMMA_SPLIT_FIELDS = new Set(['exposureHistory', 'vaccinationStatus', 'suspectedPathogen', 'malariaSpecies']);
const MEANINGFUL_ZERO_FIELDS = new Set(['parasitemia']);

const safeString = value => String(value ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.some(hasVal));
const formatDate = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return safeString(value); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return safeString(value); } };

const splitTopLevelCommas = text => {
  const source = safeString(text);
  const parts = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const splitBySentence = (text, field = '') => {
  const clauses = safeString(text).split(/(?<!\b[A-Z])(?<!\d)\.(?:\s+)|;\s+/).map(part => part.trim()).filter(Boolean);
  if (!COMMA_SPLIT_FIELDS.has(field)) return clauses;
  return clauses.flatMap(splitTopLevelCommas).filter(Boolean);
};

const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record =>
  record?.tropical_disease_assessment
    ? (Array.isArray(record.tropical_disease_assessment) ? record.tropical_disease_assessment : [record.tropical_disease_assessment])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.tropical_disease_assessment ? (Array.isArray(record.documentData.tropical_disease_assessment) ? record.documentData.tropical_disease_assessment : [record.documentData.tropical_disease_assessment]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

const TropicalDiseaseAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const rowsForField = (record, field) => {
    const value = record[field];
    if (!hasVal(value)) return [];
    if (DATE_FIELDS.has(field)) return [formatDate(value)];
    if (NUMBER_FIELDS.has(field)) {
      if (!Number.isFinite(Number(value))) return [];
      const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(field);
      return Number(value) !== 0 || MEANINGFUL_ZERO_FIELDS.has(field) || doctorEdited ? [safeString(value)] : [];
    }
    if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean' ? [value ? 'Yes' : 'No'] : [];
    if (ARRAY_FIELDS.has(field)) return (Array.isArray(value) ? value : [value]).filter(hasVal).map(safeString);
    return splitBySentence(value, field);
  };

  const fieldBody = (record, field) => {
    const values = rowsForField(record, field);
    if (!values.length) return [];
    const label = FIELD_LABELS[field] || field;
    const rows = values.map((value, index) => <Text key={`${field}-${index}`} style={styles.listItem}>{index + 1}. {safeString(value)}</Text>);
    if (rows.length <= 6) return [<View key={`${field}-field`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{rows}</View>];
    const [first, ...rest] = rows;
    return [<View key={`${field}-field`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{first}</View>, ...rest];
  };

  const renderSection = (record, sectionId) => {
    let body = [];
    SECTION_FIELDS[sectionId].forEach(field => { body = body.concat(fieldBody(record, field)); });
    if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sectionId}-${index}` }));
    const [first, ...rest] = body;
    return <View key={sectionId}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sectionId]}</Text>{first}</View>{rest}</View>;
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Tropical Disease Assessment</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No tropical disease assessment records available</Text>}
        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>{`Tropical Disease Assessment ${index + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sectionId => renderSection(record, sectionId))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TropicalDiseaseAssessmentDocumentPDFTemplate;
