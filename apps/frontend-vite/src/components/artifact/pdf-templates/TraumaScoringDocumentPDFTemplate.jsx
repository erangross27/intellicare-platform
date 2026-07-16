/** Trauma Scoring — canonical box-free PDF, collection trauma_scoring. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginTop: 9, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 1, paddingLeft: 8 },
  noDataText: { fontSize: 14, marginTop: 40 },
});

const SECTION_TITLES = {
  'glasgow-coma-scale': 'Glasgow Coma Scale',
  'trauma-scores': 'Trauma Scores',
  'vital-signs': 'Vital Signs',
  'mechanism-activation': 'Mechanism & Activation',
  'injury-distribution': 'Injury Distribution',
  'clinical-flags': 'Clinical Flags',
  'timing-disposition': 'Timing & Disposition',
};

const FIELD_LABELS = {
  glasgowComaScore: 'GCS Total',
  glasgowEyeResponse: 'Eye Response (E)',
  glasgowVerbalResponse: 'Verbal Response (V)',
  glasgowMotorResponse: 'Motor Response (M)',
  injurySeverityScore: 'Injury Severity Score (ISS)',
  revisedTraumaScore: 'Revised Trauma Score (RTS)',
  trissScore: 'TRISS Probability of Survival',
  systolicBloodPressure: 'Systolic BP (mmHg)',
  heartRate: 'Heart Rate (bpm)',
  respiratoryRate: 'Respiratory Rate',
  oxygenSaturation: 'Oxygen Saturation (%)',
  date: 'Date',
  mechanismOfInjury: 'Mechanism of Injury',
  traumaActivationLevel: 'Trauma Activation Level',
  penetratingTrauma: 'Penetrating Trauma',
  bluntTrauma: 'Blunt Trauma',
  bodyRegionsInjured: 'Body Regions Injured',
  aisScores: 'AIS Scores',
  prehospitalIntubation: 'Prehospital Intubation',
  transfusionRequired: 'Transfusion Required',
  emergentSurgeryRequired: 'Emergent Surgery Required',
  fastExamResult: 'FAST Exam Result',
  hemodynamicStability: 'Hemodynamic Stability',
  traumaBayArrivalTime: 'Trauma Bay Arrival Time',
  timeFromInjury: 'Time From Injury (minutes)',
  dispositionFromTraumaBay: 'Disposition From Trauma Bay',
};

const SECTION_FIELDS = {
  'glasgow-coma-scale': ['glasgowComaScore', 'glasgowEyeResponse', 'glasgowVerbalResponse', 'glasgowMotorResponse'],
  'trauma-scores': ['injurySeverityScore', 'revisedTraumaScore', 'trissScore'],
  'vital-signs': ['systolicBloodPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation'],
  'mechanism-activation': ['date', 'mechanismOfInjury', 'traumaActivationLevel', 'penetratingTrauma', 'bluntTrauma'],
  'injury-distribution': ['bodyRegionsInjured', 'aisScores'],
  'clinical-flags': ['prehospitalIntubation', 'transfusionRequired', 'emergentSurgeryRequired', 'fastExamResult', 'hemodynamicStability'],
  'timing-disposition': ['traumaBayArrivalTime', 'timeFromInjury', 'dispositionFromTraumaBay'],
};

const SENTENCE_FIELDS = new Set(['mechanismOfInjury', 'hemodynamicStability']);
const NUMBER_FIELDS = new Set(['glasgowComaScore', 'glasgowEyeResponse', 'glasgowVerbalResponse', 'glasgowMotorResponse', 'injurySeverityScore', 'revisedTraumaScore', 'trissScore', 'systolicBloodPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation', 'timeFromInjury']);
const HIDE_ZERO_FIELDS = new Set(['glasgowComaScore', 'glasgowEyeResponse', 'glasgowVerbalResponse', 'glasgowMotorResponse', 'revisedTraumaScore', 'trissScore', 'systolicBloodPressure', 'heartRate', 'respiratoryRate', 'oxygenSaturation', 'timeFromInjury']);
const BOOLEAN_FIELDS = new Set(['penetratingTrauma', 'bluntTrauma', 'prehospitalIntubation', 'transfusionRequired', 'emergentSurgeryRequired']);
const ARRAY_FIELDS = new Set(['bodyRegionsInjured', 'aisScores']);
const DATE_FIELDS = new Set(['date']);
const DATETIME_FIELDS = new Set(['traumaBayArrivalTime']);
const COMMA_ARRAY_FIELDS = new Set(['mechanismOfInjury', 'hemodynamicStability']);

const safeString = value => String(value ?? '').replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.length > 0);
const formatDate = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return safeString(value); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return safeString(value); } };
const formatDateTime = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return safeString(value); const d = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); const t = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }); return `${d}, ${t}`; } catch { return safeString(value); } };
const parseLabel = text => { const match = safeString(text).match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{0,60}?):\s+([\s\S]+)/); return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: safeString(text) }; };
const splitByComma = text => { const source = safeString(text); const out = []; let current = ''; let depth = 0; for (let index = 0; index < source.length; index += 1) { const ch = source[index]; if (ch === '(') { depth += 1; current += ch; } else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; } else if (ch === ',' && depth === 0) { const rest = source.slice(index + 1).trimStart(); if (/^\d{4}\b/.test(rest)) current += ch; else { if (current.trim()) out.push(current.trim()); current = ''; } } else current += ch; } if (current.trim()) out.push(current.trim()); return out.length ? out : [source]; };
const splitBySentence = text => { const source = safeString(text); const out = []; let current = ''; let depth = 0; const push = () => { if (current.trim()) out.push(current.trim()); current = ''; }; for (let index = 0; index < source.length; index += 1) { const ch = source[index]; if (ch === '(') depth += 1; if (ch === ')') depth = Math.max(0, depth - 1); const next = source[index + 1] || ''; const word = current.trim().match(/([A-Za-z]+)$/)?.[1] || ''; const period = ch === '.' && depth === 0 && /\s/.test(next) && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(word) && !/\b[A-Z]$/.test(current) && !/\d$/.test(current); const semicolon = ch === ';' && depth === 0; if (period || semicolon) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; } else current += ch; } push(); return out.length ? out : [source]; };

const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record => record?.trauma_scoring ? (Array.isArray(record.trauma_scoring) ? record.trauma_scoring : [record.trauma_scoring]) : record?.documentData ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.trauma_scoring ? (Array.isArray(record.documentData.trauma_scoring) ? record.documentData.trauma_scoring : [record.documentData.trauma_scoring]) : [record.documentData]) : [record]).filter(record => record && typeof record === 'object');

const TraumaScoringDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const fieldBody = (record, fieldName) => {
    const value = record[fieldName];
    if (!hasVal(value) || (HIDE_ZERO_FIELDS.has(fieldName) && value === 0)) return [];
    const label = FIELD_LABELS[fieldName] || fieldName;
    let rows = []; let rowNumber = 1;
    if (DATE_FIELDS.has(fieldName)) rows.push(<Text key={fieldName} style={styles.listItem}>1. {formatDate(value)}</Text>);
    else if (DATETIME_FIELDS.has(fieldName)) rows.push(<Text key={fieldName} style={styles.listItem}>1. {formatDateTime(value)}</Text>);
    else if (NUMBER_FIELDS.has(fieldName)) rows.push(<Text key={fieldName} style={styles.listItem}>1. {safeString(value)}</Text>);
    else if (BOOLEAN_FIELDS.has(fieldName)) rows.push(<Text key={fieldName} style={styles.listItem}>1. {value ? 'Yes' : 'No'}</Text>);
    else if (ARRAY_FIELDS.has(fieldName)) (Array.isArray(value) ? value : [value]).filter(hasVal).forEach((item, index) => rows.push(<Text key={index} style={styles.listItem}>{rowNumber++}. {safeString(item)}</Text>));
    else if (SENTENCE_FIELDS.has(fieldName)) splitBySentence(value).forEach((clause, clauseIndex) => {
      const parsed = parseLabel(clause);
      const source = parsed.isLabeled ? parsed.value : clause;
      const items = COMMA_ARRAY_FIELDS.has(fieldName) ? splitByComma(source) : [source];
      const itemRows = items.map((item, itemIndex) => <Text key={`${clauseIndex}-${itemIndex}`} style={styles.listItem}>{rowNumber++}. {safeString(item)}</Text>);
      if (parsed.isLabeled) rows.push(<View key={`${clauseIndex}-group`} wrap={false}><Text style={styles.subLabel}>{parsed.label}</Text>{itemRows[0]}</View>, ...itemRows.slice(1));
      else rows.push(...itemRows);
    });
    else rows.push(<Text key={fieldName} style={styles.listItem}>1. {safeString(value)}</Text>);

    if (rows.length <= 6) return [<View key={`${fieldName}-field`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{rows}</View>];
    const [first, ...rest] = rows;
    return [<View key={`${fieldName}-field`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{first}</View>, ...rest];
  };

  const renderSection = (record, sectionId) => {
    let body = [];
    SECTION_FIELDS[sectionId].forEach(fieldName => { body = body.concat(fieldBody(record, fieldName)); });
    if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sectionId}-${index}` }));
    const [first, ...rest] = body;
    return <View key={sectionId}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sectionId]}</Text>{first}</View>{rest}</View>;
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Trauma Scoring</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No trauma scoring records available</Text>}
        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>{`Trauma Scoring ${index + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sectionId => renderSection(record, sectionId))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TraumaScoringDocumentPDFTemplate;
