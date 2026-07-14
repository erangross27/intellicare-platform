/**
 * RetinalExaminationsDocumentPDFTemplate.jsx
 * July 2026 — canonical 26/19/16/13/14 hierarchy
 * Collection: retinal_examinations
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
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.35 },
  listItem: { fontSize: 14, lineHeight: 1.35, paddingLeft: 12 },
  noDataText: { fontSize: 14, marginTop: 30 },
  pageNumber: { position: 'absolute', bottom: 22, right: 40, fontSize: 10, color: '#666666' },
});

const SECTIONS = [
  { id: 'record', title: 'Record Information', fields: ['createdAt'] },
  { id: 'visualAcuity', title: 'Visual Acuity', fields: ['visualAcuityOD', 'visualAcuityOS'] },
  { id: 'pressure', title: 'Intraocular Pressure', fields: ['intraocularPressureOD', 'intraocularPressureOS'] },
  { id: 'pupils', title: 'Pupil Response', fields: ['pupilResponseOD', 'pupilResponseOS'] },
  { id: 'cupDisc', title: 'Cup-to-Disc Ratio', fields: ['cupDiscRatioOD', 'cupDiscRatioOS'] },
  { id: 'macula', title: 'Macular Appearance', fields: ['macularAppearanceOD', 'macularAppearanceOS'] },
  { id: 'vascular', title: 'Retinal Vascular Changes', fields: ['retinalVascularChangesOD', 'retinalVascularChangesOS'] },
  { id: 'retinopathy', title: 'Diabetic & Hypertensive Retinopathy', fields: ['diabeticRetinopathyGradeOD', 'diabeticRetinopathyGradeOS', 'hypertensiveRetinopathyGradeOD', 'hypertensiveRetinopathyGradeOS'] },
  { id: 'oct', title: 'Optical Coherence Tomography', fields: ['opticalCoherenceTomographyOD', 'opticalCoherenceTomographyOS'] },
  { id: 'imaging', title: 'Imaging Studies', fields: ['fundusPhotographyPerformed', 'fluoresceinAngiographyFindings'] },
  { id: 'peripheral', title: 'Peripheral Retina & Vitreous', fields: ['peripheralRetinalExaminationOD', 'peripheralRetinalExaminationOS', 'vitreousExaminationOD', 'vitreousExaminationOS'] },
  { id: 'amsler', title: 'Amsler Grid & Retinoschisis', fields: ['amslerGridTestOD', 'amslerGridTestOS', 'retinoschisisseverity'] },
];
const FIELD_LABELS = {
  createdAt: 'Examination Date',
  visualAcuityOD: 'Visual Acuity OD (Right Eye)', visualAcuityOS: 'Visual Acuity OS (Left Eye)',
  intraocularPressureOD: 'IOP OD (Right Eye)', intraocularPressureOS: 'IOP OS (Left Eye)',
  pupilResponseOD: 'Pupil Response OD (Right Eye)', pupilResponseOS: 'Pupil Response OS (Left Eye)',
  cupDiscRatioOD: 'Cup-to-Disc Ratio OD (Right Eye)', cupDiscRatioOS: 'Cup-to-Disc Ratio OS (Left Eye)',
  macularAppearanceOD: 'Macular Appearance OD (Right Eye)', macularAppearanceOS: 'Macular Appearance OS (Left Eye)',
  retinalVascularChangesOD: 'Vascular Changes OD (Right Eye)', retinalVascularChangesOS: 'Vascular Changes OS (Left Eye)',
  diabeticRetinopathyGradeOD: 'Diabetic Retinopathy Grade OD', diabeticRetinopathyGradeOS: 'Diabetic Retinopathy Grade OS',
  hypertensiveRetinopathyGradeOD: 'Hypertensive Retinopathy Grade OD', hypertensiveRetinopathyGradeOS: 'Hypertensive Retinopathy Grade OS',
  opticalCoherenceTomographyOD: 'OCT OD (Right Eye)', opticalCoherenceTomographyOS: 'OCT OS (Left Eye)',
  fundusPhotographyPerformed: 'Fundus Photography Performed', fluoresceinAngiographyFindings: 'Fluorescein Angiography Findings',
  peripheralRetinalExaminationOD: 'Peripheral Retina OD (Right Eye)', peripheralRetinalExaminationOS: 'Peripheral Retina OS (Left Eye)',
  vitreousExaminationOD: 'Vitreous OD (Right Eye)', vitreousExaminationOS: 'Vitreous OS (Left Eye)',
  amslerGridTestOD: 'Amsler Grid OD (Right Eye)', amslerGridTestOS: 'Amsler Grid OS (Left Eye)', retinoschisisseverity: 'Retinoschisis Severity',
};
const ARRAY_FIELDS = ['retinalVascularChangesOD', 'retinalVascularChangesOS'];
const BOOLEAN_FIELDS = ['fundusPhotographyPerformed'];
const DATE_FIELDS = ['createdAt'];
const DATETIME_FIELDS = [];
const NUMBER_FIELDS = ['intraocularPressureOD', 'intraocularPressureOS', 'cupDiscRatioOD', 'cupDiscRatioOS'];
const MINUTE_FIELDS = [];
const COMMA_FIELDS = ['pupilResponseOD', 'pupilResponseOS', 'macularAppearanceOD', 'macularAppearanceOS', 'opticalCoherenceTomographyOD', 'opticalCoherenceTomographyOS', 'fluoresceinAngiographyFindings', 'peripheralRetinalExaminationOD', 'peripheralRetinalExaminationOS'];
const SEMICOLON_FIELDS = ['fluoresceinAngiographyFindings'];

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
const displayText = (value) => String(value ?? '').replace(/μ/g, 'u');
const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9 /&()+-]{0,30}):\s+(.+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim() } : null;
};
const displayScalar = (field, value) => {
  if (DATE_FIELDS.includes(field)) return formatDate(value);
  if (DATETIME_FIELDS.includes(field)) return formatDateTime(value);
  if (BOOLEAN_FIELDS.includes(field)) return value ? 'Yes' : 'No';
  if (NUMBER_FIELDS.includes(field)) return `${value}${MINUTE_FIELDS.includes(field) ? ' minutes' : ''}`;
  return displayText(value);
};
const sectionBlocks = (record, section) => section.fields.flatMap((field) => {
  const value = record[field];
  if (!hasVal(value)) return [];
  const rows = ARRAY_FIELDS.includes(field)
    ? value.filter(hasVal).map(String)
    : (typeof value === 'string' && (SEMICOLON_FIELDS.includes(field) || COMMA_FIELDS.includes(field) || value.includes('. '))
      ? splitFieldValue(field, value)
      : [displayScalar(field, value)]);
  return [{
    key: field,
    fieldLabel: FIELD_LABELS[field],
    rows: rows.map((row, rowIndex) => {
    const parsed = parseLabel(row);
    return {
      key: `${field}-${rowIndex}`,
      subLabel: parsed?.label || '',
      value: displayText(parsed?.value || row),
      rowNumber: rows.length > 1 ? rowIndex + 1 : undefined,
    };
    }),
  }];
});
const unwrap = (data) => (Array.isArray(data) ? data : [data]).flatMap((record) => {
  if (record?.retinal_examinations) return Array.isArray(record.retinal_examinations) ? record.retinal_examinations : [record.retinal_examinations];
  if (record?.documentData) {
    const nested = record.documentData;
    if (Array.isArray(nested)) return nested;
    if (nested?.retinal_examinations) return Array.isArray(nested.retinal_examinations) ? nested.retinal_examinations : [nested.retinal_examinations];
    return [nested];
  }
  return [record];
}).filter((record) => record && typeof record === 'object');

const renderSection = (section, blocks) => {
  if (!blocks.length) return null;
  return <React.Fragment key={section.id}>{blocks.map((block, index) => <View key={block.key} style={styles.block} wrap={false}>
    {index === 0 && <Text style={styles.sectionTitle}>{section.title}</Text>}
    <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>
    {block.rows.map((row) => <React.Fragment key={row.key}>
      {row.subLabel && <Text style={styles.subLabel}>{row.subLabel}</Text>}
      <Text style={row.rowNumber ? styles.listItem : styles.fieldValue}>
        {row.rowNumber ? `${row.rowNumber}. ` : ''}{row.value}
      </Text>
    </React.Fragment>)}
  </View>)}</React.Fragment>;
};

export default function RetinalExaminationsDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Retinal Examinations</Text></View>
    {!records.length && <Text style={styles.noDataText}>No retinal examinations available</Text>}
    {records.map((record, recordIndex) => <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
      <View wrap={false}><Text style={styles.recordTitle}>Retinal Examination {recordIndex + 1}</Text></View>
      {SECTIONS.map((section) => renderSection(section, sectionBlocks(record, section)))}
    </View>)}
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
  </Page></Document>;
}
