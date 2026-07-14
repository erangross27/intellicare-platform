/**
 * ReturnToPlayProtocolDocumentPDFTemplate.jsx
 * July 2026 — canonical 26/19/16/13/14 hierarchy
 * Collection: return_to_play_protocol
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
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  noDataText: { fontSize: 14, marginTop: 30 },
  pageNumber: { position: 'absolute', bottom: 22, right: 40, fontSize: 10, color: '#666666' },
});

const SECTIONS = [
  { id: 'record', title: 'Record Information', fields: ['date', 'injuryType', 'injuryDate', 'sportActivity', 'competitionLevel'] },
  { id: 'current', title: 'Current Status', fields: ['currentProtocolStage', 'symptomFree', 'symptomScore', 'neurologicalClearance', 'sportSpecificDrillsTolerated'] },
  { id: 'stages', title: 'Stages Completed', fields: ['stagesCompleted'] },
  { id: 'testing', title: 'Testing', fields: ['functionalTestResults', 'rangeOfMotionMeasurements', 'strengthTestResults'] },
  { id: 'clearance', title: 'Clearance', fields: ['returnToPlayCriteria', 'clearancePhysician', 'clearanceDate', 'imagingCleared', 'physicalTherapyCompleted'] },
  { id: 'restrictions', title: 'Restrictions', fields: ['restrictionsRemaining', 'equipmentModifications', 'riskStratification'] },
  { id: 'progression', title: 'Progression', fields: ['progressionTimeline'] },
  { id: 'followUp', title: 'Follow-Up', fields: ['followUpSchedule', 'baselineTesting', 'parentalConsent'] },
];
const FIELD_LABELS = {
  date: 'Date', injuryType: 'Injury Type', injuryDate: 'Injury Date', sportActivity: 'Sport Activity', competitionLevel: 'Competition Level',
  currentProtocolStage: 'Current Protocol Stage', symptomFree: 'Symptom Free', symptomScore: 'Symptom Score', neurologicalClearance: 'Neurological Clearance', sportSpecificDrillsTolerated: 'Sport-Specific Drills Tolerated',
  stagesCompleted: 'Stages Completed', functionalTestResults: 'Functional Test Results', rangeOfMotionMeasurements: 'Range of Motion Measurements', strengthTestResults: 'Strength Test Results',
  returnToPlayCriteria: 'Return-to-Play Criteria', clearancePhysician: 'Clearance Physician', clearanceDate: 'Clearance Date', imagingCleared: 'Imaging Cleared', physicalTherapyCompleted: 'Physical Therapy Completed',
  restrictionsRemaining: 'Restrictions Remaining', equipmentModifications: 'Equipment Modifications', riskStratification: 'Risk Stratification', progressionTimeline: 'Progression Timeline',
  followUpSchedule: 'Follow-Up Schedule', baselineTesting: 'Baseline Testing', parentalConsent: 'Parental Consent',
};
const ARRAY_FIELDS = ['stagesCompleted', 'functionalTestResults', 'rangeOfMotionMeasurements', 'strengthTestResults', 'returnToPlayCriteria', 'restrictionsRemaining', 'equipmentModifications', 'followUpSchedule', 'baselineTesting'];
const BOOLEAN_FIELDS = ['symptomFree', 'neurologicalClearance', 'sportSpecificDrillsTolerated', 'imagingCleared', 'physicalTherapyCompleted', 'parentalConsent'];
const DATE_FIELDS = ['date', 'injuryDate', 'clearanceDate'];
const DATETIME_FIELDS = [];
const NUMBER_FIELDS = ['symptomScore'];
const MINUTE_FIELDS = [];
const COMMA_FIELDS = ['sportActivity'];
const SEMICOLON_FIELDS = ['progressionTimeline'];
const COMMA_ARRAY_FIELDS = ['returnToPlayCriteria'];
const LABELED_COMMA_ARRAY_FIELDS = ['functionalTestResults'];

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
const normalizeDisplay = (value) => String(value ?? '').replaceAll('≥', '>=').replaceAll('≤', '<=');
const parseLabeledItem = (value) => {
  const match = String(value || '').match(/^([^:]{2,60}):\s+(.+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim() } : { label: '', value: String(value || '') };
};
const arrayItemShape = (field, item) => {
  const parsed = parseLabeledItem(item);
  const canSplit = (COMMA_ARRAY_FIELDS.includes(field) || LABELED_COMMA_ARRAY_FIELDS.includes(field))
    && (field === 'functionalTestResults' ? Boolean(parsed.label) : /^Clearance by\s/i.test(String(item)));
  const parts = canSplit ? splitGuardedComma(parsed.value) : [String(item)];
  return {
    label: parsed.label,
    parts: parsed.label && !canSplit ? [parsed.value] : parts,
  };
};
const displayScalar = (field, value) => {
  if (DATE_FIELDS.includes(field)) return formatDate(value);
  if (DATETIME_FIELDS.includes(field)) return formatDateTime(value);
  if (BOOLEAN_FIELDS.includes(field)) return value ? 'Yes' : 'No';
  if (NUMBER_FIELDS.includes(field)) return `${value}${MINUTE_FIELDS.includes(field) ? ' minutes' : ''}`;
  return normalizeDisplay(value);
};
const sectionBlocks = (record, section) => section.fields.flatMap((field) => {
  const value = record[field];
  if (!hasVal(value)) return [];
  const labeled = typeof value === 'string' ? parseLabeledItem(value) : { label: '' };
  const groups = ARRAY_FIELDS.includes(field)
    ? value.filter(hasVal).map((item) => arrayItemShape(field, item))
    : [{
      label: labeled.label,
      parts: labeled.label
        ? [labeled.value]
        : (typeof value === 'string' && (SEMICOLON_FIELDS.includes(field) || COMMA_FIELDS.includes(field) || value.includes('. ')) ? splitFieldValue(field, value) : [displayScalar(field, value)]),
    }];
  const rowCount = groups.reduce((count, group) => count + group.parts.length, 0);
  let rowNumber = 0;
  return groups.map((group, groupIndex) => ({
    key: `${field}-${groupIndex}`,
    fieldLabel: groupIndex === 0 && FIELD_LABELS[field] !== section.title ? FIELD_LABELS[field] : '',
    nestedLabel: group.label,
    rows: group.parts.map((part) => ({ value: normalizeDisplay(part), rowNumber: rowCount > 1 ? ++rowNumber : undefined })),
  }));
});
const unwrap = (data) => (Array.isArray(data) ? data : [data]).flatMap((record) => {
  if (record?.return_to_play_protocol) return Array.isArray(record.return_to_play_protocol) ? record.return_to_play_protocol : [record.return_to_play_protocol];
  if (record?.documentData) {
    const nested = record.documentData;
    if (Array.isArray(nested)) return nested;
    if (nested?.return_to_play_protocol) return Array.isArray(nested.return_to_play_protocol) ? nested.return_to_play_protocol : [nested.return_to_play_protocol];
    return [nested];
  }
  return [record];
}).filter((record) => record && typeof record === 'object');

const renderSection = (section, blocks) => {
  if (!blocks.length) return null;
  return <React.Fragment key={section.id}>{blocks.map((block, index) => <View key={block.key} style={styles.block} wrap={false}>
    {index === 0 && <Text style={styles.sectionTitle}>{section.title}</Text>}
    {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
    {block.nestedLabel && <Text style={styles.nestedSubtitle}>{block.nestedLabel}:</Text>}
    {block.rows.map((row, rowIndex) => <Text key={rowIndex} style={row.rowNumber ? styles.listItem : styles.fieldValue}>{row.rowNumber ? `${row.rowNumber}. ${row.value}` : row.value}</Text>)}
  </View>)}</React.Fragment>;
};

export default function ReturnToPlayProtocolDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Return To Play Protocol</Text></View>
    {!records.length && <Text style={styles.noDataText}>No return to play protocol available</Text>}
    {records.map((record, recordIndex) => <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
      <View wrap={false}><Text style={styles.recordTitle}>Return To Play Protocol {recordIndex + 1}</Text></View>
      {SECTIONS.map((section) => renderSection(section, sectionBlocks(record, section)))}
    </View>)}
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
  </Page></Document>;
}
