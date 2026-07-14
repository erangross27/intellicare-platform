/**
 * ResuscitationRecordsDocumentPDFTemplate.jsx
 * July 2026 — canonical 26/19/16/13/14 hierarchy
 * Collection: resuscitation_records
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingRight: 40, paddingBottom: 48, paddingLeft: 40, fontFamily: 'Helvetica', backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 22 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 6, paddingBottom: 5, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 12, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  block: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 4, paddingBottom: 3, borderBottomWidth: .5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.35 },
  listItem: { fontSize: 14, lineHeight: 1.35, paddingLeft: 12 },
  noDataText: { fontSize: 14, marginTop: 30 },
  pageNumber: { position: 'absolute', bottom: 22, right: 40, fontSize: 10, color: '#666666' },
});

const SECTIONS = [
  { id: 'record', title: 'Record Information', fields: ['date'] },
  { id: 'arrest', title: 'Arrest Information', fields: ['arrestDateTime', 'arrestLocation', 'arrestWitnessed', 'initialRhythm'] },
  { id: 'cpr', title: 'CPR & Defibrillation', fields: ['bystanderCprProvided', 'cprStartTime', 'timeToFirstCompression', 'timeToFirstDefibrillation', 'totalShocksDelivered', 'shockEnergiesDelivered'] },
  { id: 'medications', title: 'Medications Administered', fields: ['epinephrineDoses', 'amiodaroneDoses'] },
  { id: 'airway', title: 'Airway Management', fields: ['airwayManagement', 'intubationAttempts', 'etTubeSize', 'etTubeDepth'] },
  { id: 'vascular', title: 'Vascular Access', fields: ['vascularAccess'] },
  { id: 'causes', title: 'Reversible Causes', fields: ['reversibleCausesAddressed'] },
  { id: 'outcome', title: 'Outcome', fields: ['returnOfSpontaneousCirculation', 'roscTime', 'totalResuscitationDuration', 'resuscitationOutcome'] },
  { id: 'termination', title: 'Termination', fields: ['terminationReason'] },
  { id: 'postRosc', title: 'Post-ROSC Care', fields: ['postRoscCareInitiated'] },
  { id: 'team', title: 'Team Leader', fields: ['teamLeaderName'] },
];
const FIELD_LABELS = {
  date: 'Record Date', arrestDateTime: 'Arrest Date/Time', arrestLocation: 'Arrest Location', arrestWitnessed: 'Arrest Witnessed', initialRhythm: 'Initial Rhythm',
  bystanderCprProvided: 'Bystander CPR Provided', cprStartTime: 'CPR Start Time', timeToFirstCompression: 'Time to First Compression', timeToFirstDefibrillation: 'Time to First Defibrillation', totalShocksDelivered: 'Total Shocks Delivered', shockEnergiesDelivered: 'Shock Energies Delivered',
  epinephrineDoses: 'Epinephrine Doses', amiodaroneDoses: 'Amiodarone Doses', airwayManagement: 'Airway Management Method', intubationAttempts: 'Intubation Attempts', etTubeSize: 'ET Tube Size', etTubeDepth: 'ET Tube Depth',
  vascularAccess: 'Access Lines', reversibleCausesAddressed: 'Causes Addressed', returnOfSpontaneousCirculation: 'Return of Spontaneous Circulation', roscTime: 'ROSC Time', totalResuscitationDuration: 'Total Resuscitation Duration', resuscitationOutcome: 'Resuscitation Outcome', terminationReason: 'Termination Reason', postRoscCareInitiated: 'Care Initiated', teamLeaderName: 'Team Leader Name',
};
const ARRAY_FIELDS = ['shockEnergiesDelivered', 'epinephrineDoses', 'amiodaroneDoses', 'vascularAccess', 'reversibleCausesAddressed', 'postRoscCareInitiated'];
const BOOLEAN_FIELDS = ['arrestWitnessed', 'bystanderCprProvided', 'returnOfSpontaneousCirculation'];
const DATE_FIELDS = ['date'];
const DATETIME_FIELDS = ['arrestDateTime', 'cprStartTime', 'roscTime'];
const NUMBER_FIELDS = ['timeToFirstCompression', 'timeToFirstDefibrillation', 'totalShocksDelivered', 'intubationAttempts', 'totalResuscitationDuration'];
const MINUTE_FIELDS = ['timeToFirstCompression', 'timeToFirstDefibrillation', 'totalResuscitationDuration'];
const COMMA_FIELDS = ['airwayManagement'];
const SEMICOLON_FIELDS = ['airwayManagement', 'resuscitationOutcome', 'terminationReason'];

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  return typeof value === 'object' && Object.keys(value).length > 0;
};
const asWallClock = (value) => {
  const source = String(value?.$date || value || '');
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0)));
};
const formatDate = (value) => {
  const date = asWallClock(value);
  return date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : String(value || '');
};
const formatDateTime = (value) => {
  const date = asWallClock(value);
  return date ? date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) : String(value || '');
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
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed)) || after.length === trimmed.length;
    if (protectedComma) current += char;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
const splitBySentence = (text) => String(text || '')
  .split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map((part) => part.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter((part) => part && !/^[;.,!?-]+$/.test(part));
const splitFieldValue = (field, value) => {
  const source = String(value || '');
  const firstPass = SEMICOLON_FIELDS.includes(field) || source.includes('. ') ? splitBySentence(source) : [source.trim()].filter(Boolean);
  return firstPass.flatMap((part) => COMMA_FIELDS.includes(field) ? splitGuardedComma(part) : [part]);
};
const displayScalar = (field, value) => {
  if (DATE_FIELDS.includes(field)) return formatDate(value);
  if (DATETIME_FIELDS.includes(field)) return formatDateTime(value);
  if (BOOLEAN_FIELDS.includes(field)) return value ? 'Yes' : 'No';
  if (NUMBER_FIELDS.includes(field)) return `${value}${MINUTE_FIELDS.includes(field) ? ' minutes' : ''}`;
  return String(value ?? '');
};
const sectionBlocks = (record, section) => section.fields.flatMap((field) => {
  const value = record[field];
  if (!hasVal(value)) return [];
  const rows = ARRAY_FIELDS.includes(field)
    ? value.filter(hasVal).map(String)
    : (typeof value === 'string' && (SEMICOLON_FIELDS.includes(field) || COMMA_FIELDS.includes(field) || value.includes('. '))
      ? splitFieldValue(field, value)
      : [displayScalar(field, value)]);
  return rows.map((row, rowIndex) => ({
    key: `${field}-${rowIndex}`,
    fieldLabel: rowIndex === 0 ? FIELD_LABELS[field] : '',
    value: row,
    rowNumber: rows.length > 1 ? rowIndex + 1 : undefined,
  }));
});
const unwrap = (data) => (Array.isArray(data) ? data : [data]).flatMap((record) => {
  if (record?.resuscitation_records) return Array.isArray(record.resuscitation_records) ? record.resuscitation_records : [record.resuscitation_records];
  if (record?.documentData) {
    const nested = record.documentData;
    if (Array.isArray(nested)) return nested;
    if (nested?.resuscitation_records) return Array.isArray(nested.resuscitation_records) ? nested.resuscitation_records : [nested.resuscitation_records];
    return [nested];
  }
  return [record];
}).filter((record) => record && typeof record === 'object');

const renderSection = (section, blocks) => {
  if (!blocks.length) return null;
  return <React.Fragment key={section.id}>{blocks.map((block, index) => <View key={block.key} style={styles.block} wrap={false}>
    {index === 0 && <Text style={styles.sectionTitle}>{section.title}</Text>}
    {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
    <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? `${block.rowNumber}. ${block.value}` : block.value}</Text>
  </View>)}</React.Fragment>;
};

export default function ResuscitationRecordsDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Resuscitation Records</Text></View>
    {!records.length && <Text style={styles.noDataText}>No resuscitation records available</Text>}
    {records.map((record, recordIndex) => <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
      <View wrap={false}><Text style={styles.recordTitle}>Resuscitation Record {recordIndex + 1}</Text></View>
      {SECTIONS.map((section) => renderSection(section, sectionBlocks(record, section)))}
    </View>)}
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
  </Page></Document>;
}
