import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'asthma_assessments';
const COMMA_SPLIT_FIELDS = ['symptomFrequency', 'spirometry', 'actionPlan'];
const DISPLAY_FIELDS = ['date', 'provider', 'facility', 'asthmaType', 'severity', 'controlLevel', 'symptoms', 'symptomFrequency', 'nighttimeAwakenings', 'exacerbations', 'triggers', 'spirometry', 'rescueInhalerUse', 'peakFlow', 'medications', 'actionPlan', 'notes'];

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.32, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 6, marginBottom: 14 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 2, marginBottom: 6 },
  fieldRow: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '0.5pt solid #999999', paddingBottom: 1, marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.32 },
  listItem: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 10 },
  groupedListItem: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 20 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#555555' },
});

const hasValue = value => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasValue);
  return true;
};
const safeString = value => String(value ?? '')
  .replace(/μm|µm/g, 'um').replace(/μL|µL/g, 'uL').replace(/°/g, ' deg')
  .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->');
const formatDate = value => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? safeString(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&(),.'"-]{1,80}?):\s+([\s\S]+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true }
    : { label: '', value: String(text || '').trim(), labeled: false };
};
const splitNarrative = (field, text) => {
  const source = String(text || '');
  if (!source.trim()) return [];
  const output = [];
  let current = '';
  let depth = 0;
  const push = () => { const value = current.trim(); if (value) output.push(value); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    const sentenceBreak = depth === 0 && (char === '.' || char === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]));
    let commaBreak = false;
    if (depth === 0 && char === ',' && COMMA_SPLIT_FIELDS.includes(field)) {
      const before = current.trim();
      const after = source.slice(index + 1);
      const next = after.trimStart();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(next)) || /^(?:and|or|then)\b/i.test(next) || after.length === next.length;
      commaBreak = !protectedComma;
    }
    if (sentenceBreak || commaBreak) { push(); continue; }
    current += char;
  }
  push();
  return output;
};
const unwrapRecords = source => {
  if (!source) return [];
  const queue = Array.isArray(source) ? [...source] : [source];
  const records = [];
  while (queue.length) {
    const value = queue.shift();
    if (!value) continue;
    if (Array.isArray(value)) { queue.unshift(...value); continue; }
    if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; }
    if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; }
    if (value.data !== undefined && !DISPLAY_FIELDS.some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; }
    if (value.records !== undefined) { queue.unshift(value.records); continue; }
    if (typeof value === 'object') records.push(value);
  }
  return records.filter(record => DISPLAY_FIELDS.some(field => hasValue(record[field])));
};

const fieldRow = (label, value, key) => <View style={styles.fieldRow} key={key || label} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text><Text style={styles.fieldValue}>{safeString(value)}</Text></View>;
const valueRow = (value, key, grouped = false) => <Text style={grouped ? styles.groupedListItem : styles.listItem} key={key}>{safeString(value)}</Text>;
const arrayRows = values => (Array.isArray(values) ? values : []).filter(hasValue).map((value, index) => valueRow(`${index + 1}. ${value}`, index));
const narrativeRows = (field, value) => {
  const groups = [];
  let current = null;
  splitNarrative(field, value).forEach(clause => {
    const parsed = parseLabel(clause);
    if (parsed.labeled) { current = { subtitle: parsed.label, items: [parsed.value] }; groups.push(current); }
    else if (current?.subtitle) current.items.push(parsed.value);
    else { if (!current || current.subtitle) { current = { subtitle: null, items: [] }; groups.push(current); } current.items.push(parsed.value); }
  });
  return groups.map((group, groupIndex) => <View style={styles.fieldRow} key={groupIndex} wrap={false}>{group.subtitle && <Text style={styles.fieldLabel}>{safeString(group.subtitle)}</Text>}{group.items.map((item, itemIndex) => valueRow(`${itemIndex + 1}. ${item}`, itemIndex, !!group.subtitle))}</View>);
};
const renderSection = (title, rows, key) => {
  const visible = rows.filter(Boolean);
  if (!visible.length) return null;
  const [first, ...rest] = visible;
  return <View style={styles.section} key={key}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{first}</View>{rest}</View>;
};
const chartRows = record => {
  const rows = [];
  const act = String(record.controlLevel || '').match(/ACT\s*(?:Score\s*)?(\d+)\/(\d+)/i);
  if (act) rows.push(fieldRow('ACT Score', `${act[1]}/${act[2]}`, 'act'));
  const fev1 = String(record.spirometry || '').match(/FEV1[\s\S]{0,40}?(\d+(?:\.\d+)?)%\s*predicted/i);
  if (fev1) rows.push(fieldRow('FEV1', `${fev1[1]}% predicted`, 'fev1'));
  const biomarkers = [
    ['FeNO', /FeNO\s*(\d+(?:\.\d+)?)\s*ppb/i, ' ppb'],
    ['Eosinophils', /Eosinophils\s*(\d+(?:\.\d+)?)\s*(?:cells\/uL|cells\/μL)?/i, ' cells/uL'],
    ['IgE', /(?:Total\s+)?IgE\s*(\d+(?:\.\d+)?)\s*IU\/mL/i, ' IU/mL'],
  ];
  biomarkers.forEach(([label, pattern, unit]) => { const match = String(record.notes || '').match(pattern); if (match) rows.push(fieldRow(label, `${match[1]}${unit}`, label)); });
  return rows;
};

const AsthmaAssessmentsDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Asthma Assessments</Text><Text style={styles.noData}>No asthma assessments available</Text></Page></Document>;
  return <Document><Page size="A4" style={styles.page} wrap><Text style={styles.documentTitle}>Asthma Assessments</Text>{records.map((record, index) => {
    const assessmentInfo = [];
    if (hasValue(record.date)) assessmentInfo.push(fieldRow('Date', formatDate(record.date), 'date'));
    if (hasValue(record.provider)) assessmentInfo.push(fieldRow('Provider', record.provider, 'provider'));
    if (hasValue(record.facility)) assessmentInfo.push(fieldRow('Facility', record.facility, 'facility'));
    if (hasValue(record.asthmaType)) assessmentInfo.push(fieldRow('Asthma Type', record.asthmaType, 'asthmaType'));
    if (hasValue(record.severity)) assessmentInfo.push(fieldRow('Severity', record.severity, 'severity'));
    const symptomRows = [];
    if (Array.isArray(record.symptoms) && record.symptoms.some(hasValue)) symptomRows.push(<View style={styles.fieldRow} key="symptoms" wrap={false}>{arrayRows(record.symptoms)}</View>);
    if (hasValue(record.symptomFrequency)) symptomRows.push(...narrativeRows('symptomFrequency', record.symptomFrequency).map((row, rowIndex) => <View style={styles.fieldRow} key={`frequency-${rowIndex}`} wrap={false}><Text style={styles.fieldLabel}>Symptom Frequency</Text>{row}</View>));
    if (hasValue(record.nighttimeAwakenings)) symptomRows.push(fieldRow('Nighttime Awakenings', record.nighttimeAwakenings, 'nighttimeAwakenings'));
    return <React.Fragment key={record._id?.$oid || String(record._id || index)}><View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Asthma Assessment {index + 1}</Text></View>{renderSection('Assessment Information', assessmentInfo, 'assessmentInfo')}{chartRows(record).length > 0 && renderSection('Score Overview', chartRows(record), 'scoreOverview')}{hasValue(record.controlLevel) && renderSection('Control Level', [valueRow(record.controlLevel, 'controlLevel')], 'controlLevel')}{renderSection('Symptoms', symptomRows, 'symptoms')}{hasValue(record.exacerbations) && renderSection('Exacerbations', narrativeRows('exacerbations', record.exacerbations), 'exacerbations')}{Array.isArray(record.triggers) && record.triggers.some(hasValue) && renderSection('Triggers', arrayRows(record.triggers), 'triggers')}{hasValue(record.spirometry) && renderSection('Spirometry', narrativeRows('spirometry', record.spirometry), 'spirometry')}{hasValue(record.rescueInhalerUse) && renderSection('Rescue Inhaler Use', [valueRow(record.rescueInhalerUse, 'rescue')], 'rescueInhalerUse')}{hasValue(record.peakFlow) && renderSection('Peak Flow', [valueRow(record.peakFlow, 'peakFlow')], 'peakFlow')}{Array.isArray(record.medications) && record.medications.some(hasValue) && renderSection('Medications', arrayRows(record.medications), 'medications')}{hasValue(record.actionPlan) && renderSection('Action Plan', narrativeRows('actionPlan', record.actionPlan), 'actionPlan')}{hasValue(record.notes) && renderSection('Notes', narrativeRows('notes', record.notes), 'notes')}</React.Fragment>;
  })}</Page></Document>;
};

export default AsthmaAssessmentsDocumentPDFTemplate;
