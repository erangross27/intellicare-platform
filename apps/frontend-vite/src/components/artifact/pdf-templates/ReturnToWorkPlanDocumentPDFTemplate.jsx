/**
 * ReturnToWorkPlanDocumentPDFTemplate.jsx
 * July 2026 — canonical 26/19/16/13/14 hierarchy
 * Collection: return_to_work_plan
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingRight: 40, paddingBottom: 40, paddingLeft: 40, fontFamily: 'Helvetica', backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 14 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 6, paddingBottom: 5, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  block: { marginBottom: 3 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 2, marginBottom: 4, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 4, paddingBottom: 3, borderBottomWidth: .5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.35 },
  listItem: { fontSize: 14, lineHeight: 1.35, paddingLeft: 12 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  noDataText: { fontSize: 14, marginTop: 30 },
  pageNumber: { position: 'absolute', bottom: 22, right: 40, fontSize: 10, color: '#666666' },
});

const SECTIONS = [
  { id: 'plan', title: 'Plan Information', fields: ['date', 'diagnosisCode', 'treatingPhysician', 'workersCompClaim'] },
  { id: 'employment', title: 'Employment Details', fields: ['jobTitle', 'employerName'] },
  { id: 'injury', title: 'Injury Summary', fields: ['injuryDate', 'injuryDescription'] },
  { id: 'status', title: 'Work Status', fields: ['workAbilityStatus', 'maxWorkCategory', 'estimatedReturnDate'] },
  { id: 'schedule', title: 'Work Schedule', fields: ['hoursPerDayAllowed', 'daysPerWeekAllowed', 'modifiedDutyStartDate', 'modifiedDutyEndDate'] },
  { id: 'restrictions', title: 'Restrictions', fields: ['liftingRestriction', 'postureRestrictions', 'durationRestrictions', 'repetitiveMotionLimits', 'environmentalRestrictions'] },
  { id: 'accommodations', title: 'Accommodations Required', fields: ['accommodationsRequired'] },
  { id: 'treatment', title: 'Treatment Progress', fields: ['physicalTherapyRequired', 'functionalCapacityEvaluation', 'maximumMedicalImprovement', 'permanentRestrictions', 'restrictionReviewDate'] },
];
const FIELD_LABELS = {
  date: 'Plan Date', diagnosisCode: 'Diagnosis Code', treatingPhysician: 'Treating Physician', workersCompClaim: 'Workers Comp Claim',
  jobTitle: 'Job Title', employerName: 'Employer', injuryDate: 'Injury Date', injuryDescription: 'Injury Description',
  workAbilityStatus: 'Work Ability Status', maxWorkCategory: 'Max Work Category', estimatedReturnDate: 'Estimated Return Date',
  hoursPerDayAllowed: 'Hours Per Day Allowed', daysPerWeekAllowed: 'Days Per Week Allowed', modifiedDutyStartDate: 'Modified Duty Start', modifiedDutyEndDate: 'Modified Duty End',
  liftingRestriction: 'Lifting Restriction', postureRestrictions: 'Posture Restrictions', durationRestrictions: 'Duration Restrictions', repetitiveMotionLimits: 'Repetitive Motion Limits', environmentalRestrictions: 'Environmental Restrictions',
  accommodationsRequired: 'Accommodations Required', physicalTherapyRequired: 'Physical Therapy Required', functionalCapacityEvaluation: 'Functional Capacity Evaluation', maximumMedicalImprovement: 'Maximum Medical Improvement', permanentRestrictions: 'Permanent Restrictions', restrictionReviewDate: 'Restriction Review Date',
};
const ARRAY_FIELDS = ['postureRestrictions', 'environmentalRestrictions', 'accommodationsRequired'];
const BOOLEAN_FIELDS = ['physicalTherapyRequired', 'functionalCapacityEvaluation', 'maximumMedicalImprovement', 'permanentRestrictions'];
const DATE_FIELDS = ['date', 'injuryDate', 'estimatedReturnDate', 'modifiedDutyStartDate', 'modifiedDutyEndDate', 'restrictionReviewDate'];
const DATETIME_FIELDS = [];
const NUMBER_FIELDS = ['hoursPerDayAllowed', 'daysPerWeekAllowed'];
const MINUTE_FIELDS = [];
const COMMA_FIELDS = [];
const SEMICOLON_FIELDS = ['injuryDescription', 'liftingRestriction', 'durationRestrictions', 'repetitiveMotionLimits'];
const COMMA_ARRAY_FIELDS = [];
const LABELED_COMMA_ARRAY_FIELDS = [];

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
  if (record?.return_to_work_plan) return Array.isArray(record.return_to_work_plan) ? record.return_to_work_plan : [record.return_to_work_plan];
  if (record?.documentData) {
    const nested = record.documentData;
    if (Array.isArray(nested)) return nested;
    if (nested?.return_to_work_plan) return Array.isArray(nested.return_to_work_plan) ? nested.return_to_work_plan : [nested.return_to_work_plan];
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

export default function ReturnToWorkPlanDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Return To Work Plan</Text></View>
    {!records.length && <Text style={styles.noDataText}>No return to work plan available</Text>}
    {records.map((record, recordIndex) => <React.Fragment key={recordIndex}>
      <View wrap={false} break={recordIndex > 0}><Text style={styles.recordTitle}>Return To Work Plan {recordIndex + 1}</Text></View>
      {SECTIONS.map((section) => renderSection(section, sectionBlocks(record, section)))}
    </React.Fragment>)}
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
  </Page></Document>;
}
