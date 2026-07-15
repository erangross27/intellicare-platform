import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.35, color: '#000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'solid', marginBottom: 12 },
  block: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999', borderBottomStyle: 'solid', marginBottom: 4 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  fieldValue: { fontSize: 14, marginBottom: 3 },
  listItem: { fontSize: 14, marginBottom: 3, paddingLeft: 10 },
  noDataText: { fontSize: 14, marginTop: 24 },
  pageNumber: { position: 'absolute', bottom: 18, right: 36, fontSize: 10, color: '#555' },
});

const FIELD_LABELS = {
  specimenCollectionMethod: 'Specimen Collection Method',
  abstinencePeriodDays: 'Abstinence Period (days)',
  semenVolumeMl: 'Semen Volume (mL)',
  liquefactionTimeMinutes: 'Liquefaction Time (minutes)',
  semenViscosity: 'Semen Viscosity',
  semenPh: 'Semen pH',
  semenAppearance: 'Semen Appearance',
  spermConcentrationMillionPerMl: 'Sperm Concentration (million/mL)',
  totalSpermCountMillion: 'Total Sperm Count (million)',
  roundCellConcentrationMillionPerMl: 'Round Cell Concentration (million/mL)',
  leukocyteConcentrationMillionPerMl: 'Leukocyte Concentration (million/mL)',
  totalMotilityPercent: 'Total Motility (%)',
  progressiveMotilityPercent: 'Progressive Motility (%)',
  nonProgressiveMotilityPercent: 'Non-Progressive Motility (%)',
  immotileSpermPercent: 'Immotile Sperm (%)',
  spermMotilityGrade: 'Sperm Motility Grade',
  normalMorphologyPercent: 'Normal Morphology (%)',
  headDefectsPercent: 'Head Defects (%)',
  midpieceDefectsPercent: 'Midpiece Defects (%)',
  tailDefectsPercent: 'Tail Defects (%)',
  teratozoospermiaIndex: 'Teratozoospermia Index',
  spermVitalityPercent: 'Sperm Vitality (%)',
  dnaFragmentationIndexPercent: 'DNA Fragmentation Index (%)',
  spermAgglutinationGrade: 'Sperm Agglutination Grade',
  antispermAntibodiesPresent: 'Antisperm Antibodies Present',
  marTestPercent: 'MAR Test (%)',
  fructoseLevelMgPerDl: 'Fructose Level (mg/dL)',
  zincConcentrationUmolPerL: 'Zinc Concentration (µmol/L)',
  semenCultureResult: 'Semen Culture Result',
  whoSemenAnalysisDiagnosis: 'WHO Semen Analysis Diagnosis',
};
const NUMBER_FIELDS = new Set(['abstinencePeriodDays', 'semenVolumeMl', 'liquefactionTimeMinutes', 'semenPh', 'spermConcentrationMillionPerMl', 'totalSpermCountMillion', 'roundCellConcentrationMillionPerMl', 'leukocyteConcentrationMillionPerMl', 'totalMotilityPercent', 'progressiveMotilityPercent', 'nonProgressiveMotilityPercent', 'immotileSpermPercent', 'normalMorphologyPercent', 'headDefectsPercent', 'midpieceDefectsPercent', 'tailDefectsPercent', 'teratozoospermiaIndex', 'spermVitalityPercent', 'dnaFragmentationIndexPercent', 'marTestPercent', 'fructoseLevelMgPerDl', 'zincConcentrationUmolPerL']);
const MEANINGFUL_ZERO_FIELDS = new Set(['semenVolumeMl', 'spermConcentrationMillionPerMl', 'totalSpermCountMillion', 'roundCellConcentrationMillionPerMl', 'leukocyteConcentrationMillionPerMl', 'totalMotilityPercent', 'progressiveMotilityPercent', 'nonProgressiveMotilityPercent', 'immotileSpermPercent', 'normalMorphologyPercent', 'headDefectsPercent', 'midpieceDefectsPercent', 'tailDefectsPercent', 'teratozoospermiaIndex', 'spermVitalityPercent', 'dnaFragmentationIndexPercent', 'marTestPercent', 'fructoseLevelMgPerDl']);
const BOOLEAN_FIELDS = new Set(['antispermAntibodiesPresent']);
const ARRAY_FIELDS = new Set(['whoSemenAnalysisDiagnosis']);
const COMMA_FIELDS = new Set(['semenCultureResult']);
const SECTIONS = [
  { id: 'specimen', title: 'Specimen', fields: ['specimenCollectionMethod', 'abstinencePeriodDays', 'semenVolumeMl', 'liquefactionTimeMinutes', 'semenViscosity', 'semenPh', 'semenAppearance'] },
  { id: 'concentration', title: 'Concentration & Count', fields: ['spermConcentrationMillionPerMl', 'totalSpermCountMillion', 'roundCellConcentrationMillionPerMl', 'leukocyteConcentrationMillionPerMl'] },
  { id: 'motility', title: 'Motility', fields: ['totalMotilityPercent', 'progressiveMotilityPercent', 'nonProgressiveMotilityPercent', 'immotileSpermPercent', 'spermMotilityGrade'] },
  { id: 'morphology', title: 'Morphology', fields: ['normalMorphologyPercent', 'headDefectsPercent', 'midpieceDefectsPercent', 'tailDefectsPercent', 'teratozoospermiaIndex'] },
  { id: 'vitality', title: 'Vitality & DNA', fields: ['spermVitalityPercent', 'dnaFragmentationIndexPercent', 'spermAgglutinationGrade'] },
  { id: 'antibodies', title: 'Antisperm Antibodies', fields: ['antispermAntibodiesPresent', 'marTestPercent'] },
  { id: 'biochemistry', title: 'Biochemistry & Culture', fields: ['fructoseLevelMgPerDl', 'zincConcentrationUmolPerL', 'semenCultureResult'] },
  { id: 'diagnosis', title: 'WHO Diagnosis', fields: ['whoSemenAnalysisDiagnosis'] },
];

const hasVal = value => value !== null && value !== undefined && value !== ''
  && (!Array.isArray(value) || value.some(hasVal));
const displayScalar = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const numberShows = (record, field) => {
  if (!hasVal(record[field])) return false;
  const number = Number(record[field]);
  if (Number.isNaN(number)) return false;
  if (number !== 0 || MEANINGFUL_ZERO_FIELDS.has(field)) return true;
  return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(field);
};
const splitBySentence = text => String(text || '')
  .split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map(part => part.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim()).filter(Boolean);
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { label: match[1].trim(), value: match[2].trim() } : null;
};
const splitByComma = text => {
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
    const next = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const previous = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed))
      || after.length === trimmed.length
      || ['and', 'or', 'then'].includes(next)
      || ['and', 'or'].includes(previous);
    if (protectedComma) current += char;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
const unwrap = data => (Array.isArray(data) ? data : [data]).flatMap(record => {
  if (record?.sperm_analysis) return Array.isArray(record.sperm_analysis) ? record.sperm_analysis : [record.sperm_analysis];
  if (record?.documentData) {
    const nested = record.documentData;
    if (Array.isArray(nested)) return nested;
    if (nested?.sperm_analysis) return Array.isArray(nested.sperm_analysis) ? nested.sperm_analysis : [nested.sperm_analysis];
    return [nested];
  }
  return [record];
}).filter(record => record && typeof record === 'object');

const fieldBlocks = (record, field) => {
  const label = FIELD_LABELS[field] || field;
  const value = record[field];
  if (NUMBER_FIELDS.has(field)) return numberShows(record, field)
    ? [{ key: field, groupKey: field, fieldLabel: label, value: displayScalar(value), rowNumber: 1 }]
    : [];
  if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean'
    ? [{ key: field, groupKey: field, fieldLabel: label, value: displayScalar(value), rowNumber: 1 }]
    : [];
  if (ARRAY_FIELDS.has(field)) return (Array.isArray(value) ? value : []).filter(hasVal).map((item, index) => ({
    key: field + '-' + index,
    groupKey: field,
    fieldLabel: index === 0 ? label : '',
    value: displayScalar(item),
    rowNumber: index + 1,
  }));
  if (!hasVal(value)) return [];
  const rows = splitBySentence(value).flatMap(part => {
    const parsed = parseLabel(part);
    if (!parsed) return [{ value: part, subLabel: '' }];
    const parts = COMMA_FIELDS.has(field) ? splitByComma(parsed.value) : [parsed.value];
    return parts.map(item => ({ value: item, subLabel: parsed.label }));
  });
  return rows.map((row, index) => ({
    key: field + '-' + index,
    groupKey: field,
    fieldLabel: index === 0 ? label : '',
    subLabel: index === 0 ? row.subLabel : '',
    value: row.value,
    rowNumber: index + 1,
  }));
};
const chunk = (items, size = 6) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};
const renderSection = (record, section) => {
  const groups = section.fields.map(field => fieldBlocks(record, field)).filter(group => group.length);
  if (!groups.length) return null;
  let rendered = 0;
  return <View key={section.id}>{groups.flatMap(group => chunk(group)).map((groupChunk, chunkIndex) => (
    <View key={groupChunk[0].groupKey + '-' + chunkIndex} wrap={false}>
      {groupChunk.map(block => {
        const index = rendered++;
        return <View key={block.key} style={styles.block} wrap={false}>
          {index === 0 && <Text style={styles.sectionTitle}>{section.title}</Text>}
          {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
          {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
          <Text style={styles.listItem}>{block.rowNumber}. {block.value}</Text>
        </View>;
      })}
    </View>
  ))}</View>;
};

export default function SpermAnalysisDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Sperm Analysis</Text></View>
    {!records.length && <Text style={styles.noDataText}>No sperm analysis data available</Text>}
    {records.map((record, recordIndex) => <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
      <View wrap={false}><Text style={styles.recordTitle}>Sperm Analysis {recordIndex + 1}</Text></View>
      {SECTIONS.map(section => renderSection(record, section))}
    </View>)}
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => pageNumber + ' / ' + totalPages} fixed />
  </Page></Document>;
}
