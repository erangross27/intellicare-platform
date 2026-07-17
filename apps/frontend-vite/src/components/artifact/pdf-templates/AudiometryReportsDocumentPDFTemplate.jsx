import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'audiometry_reports';
const COMMA_SPLIT_FIELDS = ['testType', 'speechReception', 'wordRecognition', 'hearingLossSeverity', 'interpretation', 'recommendations'];
const DISPLAY_FIELDS = ['date', 'audiologist', 'facility', 'testType', 'hearingLossType', 'hearingLossSeverity', 'rightEarThresholds', 'leftEarThresholds', 'speechReception', 'wordRecognition', 'tympanometry', 'acousticReflex', 'interpretation', 'recommendations', 'notes'];

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
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return true;
};
const safeString = value => String(value ?? '');
const formatDate = value => {
  if (!value) return '';
  const raw = value.$date || value;
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return safeString(raw);
  try {
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? safeString(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch { return safeString(raw); }
};
const getFrequencyKeys = thresholds => Object.keys(thresholds || {}).sort((left, right) => {
  const leftNumber = Number.parseFloat(left);
  const rightNumber = Number.parseFloat(right);
  if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) return String(left).localeCompare(String(right));
  return leftNumber - rightNumber;
});
const formatFrequency = value => /hz$/i.test(String(value)) ? String(value) : `${value}Hz`;
const thresholdText = value => typeof value === 'number' ? `${value} dB` : safeString(value);
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&()'"-]{1,60}?):\s+([\s\S]+)$/);
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
    const character = source[index];
    if (character === '(') { depth += 1; current += character; continue; }
    if (character === ')') { depth = Math.max(0, depth - 1); current += character; continue; }
    const sentenceBreak = depth === 0 && (character === '.' || character === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]));
    let commaBreak = false;
    if (depth === 0 && character === ',' && COMMA_SPLIT_FIELDS.includes(field)) {
      const before = current.trim();
      const after = source.slice(index + 1);
      const next = after.trimStart();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(next)) || /^(?:and|or)\b/i.test(next) || after.length === next.length;
      commaBreak = !protectedComma;
    }
    if (sentenceBreak || commaBreak) { push(); continue; }
    current += character;
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
const narrativeRows = (field, value, fallbackLabel) => {
  const groups = [];
  let current = null;
  splitNarrative(field, value).forEach(clause => {
    const parsed = parseLabel(clause);
    if (parsed.labeled) { current = { subtitle: parsed.label, items: [parsed.value] }; groups.push(current); }
    else if (current?.subtitle) current.items.push(parsed.value);
    else {
      if (!current || current.subtitle) { current = { subtitle: null, items: [] }; groups.push(current); }
      current.items.push(parsed.value);
    }
  });
  return groups.map((group, groupIndex) => <View style={styles.fieldRow} key={`${field}-${groupIndex}`} wrap={false}>{fallbackLabel && groupIndex === 0 && <Text style={styles.fieldLabel}>{fallbackLabel}</Text>}{group.subtitle && <Text style={styles.fieldLabel}>{group.subtitle}</Text>}{group.items.map((item, itemIndex) => valueRow(`${itemIndex + 1}. ${item}`, `${field}-${groupIndex}-${itemIndex}`, !!(group.subtitle || fallbackLabel)))}</View>);
};
const thresholdRows = (label, thresholds, key) => {
  if (!thresholds || typeof thresholds !== 'object') return [];
  const keys = getFrequencyKeys(thresholds).filter(frequency => hasValue(thresholds[frequency]));
  if (!keys.length) return [];
  return keys.map((frequency, index) => <View style={styles.fieldRow} key={`${key}-${frequency}`} wrap={false}>{index === 0 && <Text style={styles.fieldLabel}>{label}</Text>}<Text style={styles.fieldLabel}>{formatFrequency(frequency)}</Text><Text style={styles.fieldValue}>{thresholdText(thresholds[frequency])}</Text></View>);
};
const renderSection = (title, rows, key) => {
  const visible = rows.flat().filter(Boolean);
  if (!visible.length) return null;
  const [first, ...rest] = visible;
  return <View style={styles.section} key={key}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{first}</View>{rest}</View>;
};

const AudiometryReportsDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Audiometry Reports</Text><Text style={styles.noData}>No audiometry reports available</Text></Page></Document>;
  return <Document><Page size="A4" style={styles.page} wrap><Text style={styles.documentTitle}>Audiometry Reports</Text>{records.map((record, index) => {
    const recordRows = [
      hasValue(record.date) ? fieldRow('Date', formatDate(record.date), 'date') : null,
      hasValue(record.audiologist) ? fieldRow('Audiologist', record.audiologist, 'audiologist') : null,
      hasValue(record.facility) ? fieldRow('Facility', record.facility, 'facility') : null,
    ];
    const testRows = [];
    if (hasValue(record.testType)) testRows.push(...narrativeRows('testType', record.testType, 'Test Type'));
    if (hasValue(record.hearingLossType)) testRows.push(fieldRow('Hearing Loss Type', record.hearingLossType, 'hearingLossType'));
    if (hasValue(record.hearingLossSeverity)) testRows.push(...narrativeRows('hearingLossSeverity', record.hearingLossSeverity, 'Hearing Loss Severity'));
    const thresholdRowsAll = [
      ...thresholdRows('Right Ear Thresholds', record.rightEarThresholds, 'rightEarThresholds'),
      ...thresholdRows('Left Ear Thresholds', record.leftEarThresholds, 'leftEarThresholds'),
    ];
    const speechRows = [];
    if (hasValue(record.speechReception)) speechRows.push(...narrativeRows('speechReception', record.speechReception, 'Speech Reception Threshold'));
    if (hasValue(record.wordRecognition)) speechRows.push(...narrativeRows('wordRecognition', record.wordRecognition, 'Word Recognition'));
    const middleRows = [
      hasValue(record.tympanometry) ? fieldRow('Tympanometry', record.tympanometry, 'tympanometry') : null,
      hasValue(record.acousticReflex) ? fieldRow('Acoustic Reflexes', record.acousticReflex, 'acousticReflex') : null,
    ];
    const interpretationRows = hasValue(record.interpretation) ? narrativeRows('interpretation', record.interpretation, null) : [];
    const recommendationRows = hasValue(record.recommendations) ? narrativeRows('recommendations', record.recommendations, null) : [];
    const noteRows = [hasValue(record.notes) ? <View style={styles.fieldRow} key="notes" wrap={false}><Text style={styles.fieldValue}>{safeString(record.notes)}</Text></View> : null];
    return <React.Fragment key={record._id?.$oid || String(record._id || index)}><View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Audiometry Report {index + 1}</Text></View>{renderSection('Record Information', recordRows, 'recordInfo')}{renderSection('Test Information', testRows, 'testInfo')}{renderSection('Audiogram Overview', thresholdRowsAll, 'audiogramOverview')}{renderSection('Speech Results', speechRows, 'speechResults')}{renderSection('Middle Ear Function', middleRows, 'middleEarFunction')}{renderSection('Interpretation', interpretationRows, 'interpretation')}{renderSection('Recommendations', recommendationRows, 'recommendations')}{renderSection('Notes', noteRows, 'notes')}</React.Fragment>;
  })}</Page></Document>;
};

export default AudiometryReportsDocumentPDFTemplate;
