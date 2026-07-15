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
  spinalSegmentsTreated: 'Spinal Segments Treated', manipulationTechnique: 'Manipulation Technique', thrustDirection: 'Thrust Direction', patientPositioning: 'Patient Positioning', forceAmplitude: 'Force and Amplitude', vertebralSubluxationComplex: 'Vertebral Subluxation Complex', preManipulationRomCervical: 'Pre-Manipulation ROM (Cervical)', postManipulationRomCervical: 'Post-Manipulation ROM (Cervical)', preManipulationRomLumbar: 'Pre-Manipulation ROM (Lumbar)', postManipulationRomLumbar: 'Post-Manipulation ROM (Lumbar)', painVasPreTreatment: 'Pain VAS Pre-Treatment', painVasPostTreatment: 'Pain VAS Post-Treatment', oswestryDisabilityIndex: 'Oswestry Disability Index', neckDisabilityIndex: 'Neck Disability Index', palpationFindings: 'Palpation Findings', sacroiliacJointDysfunction: 'Sacroiliac Joint Dysfunction', straightLegRaiseTest: 'Straight Leg Raise Test', neurologicalClearance: 'Neurological Clearance', dermatomeInvolvement: 'Dermatome Involvement', vertebrobasilarScreening: 'Vertebrobasilar Screening', contraindicationsScreened: 'Contraindications Screened', cavitationAchieved: 'Cavitation Achieved', muscleEnergyTechniqueApplied: 'Muscle Energy Technique Applied', adverseReactionDocumented: 'Adverse Reaction', informedConsentObtained: 'Informed Consent Obtained',
};
const NUMBER_FIELDS = new Set(['painVasPreTreatment', 'painVasPostTreatment', 'oswestryDisabilityIndex', 'neckDisabilityIndex']);
const BOOLEAN_FIELDS = new Set(['cavitationAchieved', 'muscleEnergyTechniqueApplied', 'informedConsentObtained', 'neurologicalClearance']);
const ARRAY_FIELDS = new Set(['spinalSegmentsTreated', 'contraindicationsScreened']);
const COMMA_FIELDS = new Set(['manipulationTechnique', 'thrustDirection', 'patientPositioning', 'preManipulationRomCervical', 'postManipulationRomCervical', 'preManipulationRomLumbar', 'postManipulationRomLumbar', 'straightLegRaiseTest']);
const SECTIONS = [
  { id: 'segments-treated', title: 'Spinal Segments Treated', fields: ['spinalSegmentsTreated'] },
  { id: 'manipulation-technique', title: 'Manipulation Technique', fields: ['manipulationTechnique'] },
  { id: 'thrust-direction', title: 'Thrust Direction', fields: ['thrustDirection'] },
  { id: 'patient-positioning', title: 'Patient Positioning', fields: ['patientPositioning'] },
  { id: 'force-amplitude', title: 'Force and Amplitude', fields: ['forceAmplitude'] },
  { id: 'subluxation-complex', title: 'Vertebral Subluxation Complex', fields: ['vertebralSubluxationComplex'] },
  { id: 'range-of-motion', title: 'Range of Motion', fields: ['preManipulationRomCervical', 'postManipulationRomCervical', 'preManipulationRomLumbar', 'postManipulationRomLumbar'] },
  { id: 'pain-scores', title: 'Pain & Disability Scores', fields: ['painVasPreTreatment', 'painVasPostTreatment', 'oswestryDisabilityIndex', 'neckDisabilityIndex'] },
  { id: 'palpation', title: 'Palpation Findings', fields: ['palpationFindings'] },
  { id: 'si-dysfunction', title: 'Sacroiliac Joint Dysfunction', fields: ['sacroiliacJointDysfunction'] },
  { id: 'ortho-neuro-tests', title: 'Orthopedic & Neurological Tests', fields: ['straightLegRaiseTest', 'neurologicalClearance', 'dermatomeInvolvement', 'vertebrobasilarScreening'] },
  { id: 'contraindications', title: 'Contraindications Screened', fields: ['contraindicationsScreened'] },
  { id: 'treatment-outcome', title: 'Treatment Outcome', fields: ['cavitationAchieved', 'muscleEnergyTechniqueApplied', 'adverseReactionDocumented', 'informedConsentObtained'] },
];

const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal));
const displayScalar = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
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
  if (record?.spinal_manipulation_record) return Array.isArray(record.spinal_manipulation_record) ? record.spinal_manipulation_record : [record.spinal_manipulation_record];
  if (record?.documentData) {
    const nested = record.documentData;
    if (Array.isArray(nested)) return nested;
    if (nested?.spinal_manipulation_record) return Array.isArray(nested.spinal_manipulation_record) ? nested.spinal_manipulation_record : [nested.spinal_manipulation_record];
    return [nested];
  }
  return [record];
}).filter(record => record && typeof record === 'object');

const fieldBlocks = (record, field, sectionTitle) => {
  const label = FIELD_LABELS[field] || field;
  const showFieldLabel = label.trim().toLowerCase() !== sectionTitle.trim().toLowerCase();
  const value = record[field];
  if (NUMBER_FIELDS.has(field)) return hasVal(value) ? [{ key: field, groupKey: field, fieldLabel: showFieldLabel ? label : '', value: displayScalar(value), rowNumber: 1 }] : [];
  if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean' ? [{ key: field, groupKey: field, fieldLabel: showFieldLabel ? label : '', value: displayScalar(value), rowNumber: 1 }] : [];
  if (ARRAY_FIELDS.has(field)) return (Array.isArray(value) ? value : []).filter(hasVal).map((item, index) => ({ key: field + '-' + index, groupKey: field, fieldLabel: index === 0 && showFieldLabel ? label : '', value: displayScalar(item), rowNumber: index + 1 }));
  if (!hasVal(value)) return [];
  const rows = [];
  splitBySentence(value).forEach((sentence, sentenceIndex) => {
    const parsed = parseLabel(sentence);
    const items = COMMA_FIELDS.has(field) ? splitByComma(parsed?.value || sentence) : [parsed?.value || sentence];
    items.forEach((item, itemIndex) => rows.push({
      key: field + '-' + sentenceIndex + '-' + itemIndex,
      groupKey: field + '-' + sentenceIndex,
      fieldLabel: rows.length === 0 && showFieldLabel ? label : '',
      subLabel: itemIndex === 0 ? parsed?.label || '' : '',
      value: item,
      rowNumber: rows.length + 1,
    }));
  });
  return rows;
};
const chunk = (items, size = 6) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};
const renderSection = (record, section) => {
  const blocks = section.fields.flatMap(field => fieldBlocks(record, field, section.title));
  if (!blocks.length) return null;
  const groups = [];
  blocks.forEach(block => {
    const previous = groups[groups.length - 1];
    if (previous?.key === block.groupKey) previous.blocks.push(block);
    else groups.push({ key: block.groupKey, blocks: [block] });
  });
  let rendered = 0;
  return <View key={section.id}>{groups.flatMap(group => chunk(group.blocks).map((blocksChunk, index) => ({ key: group.key + '-' + index, blocks: blocksChunk }))).map(group => (
    <View key={group.key} wrap={false}>{group.blocks.map(block => {
      const index = rendered++;
      return <View key={block.key} style={styles.block} wrap={false}>
        {index === 0 && <Text style={styles.sectionTitle}>{section.title}</Text>}
        {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
        {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
        <Text style={styles.listItem}>{block.rowNumber}. {block.value}</Text>
      </View>;
    })}</View>
  ))}</View>;
};

export default function SpinalManipulationRecordDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Spinal Manipulation Record</Text></View>
    {!records.length && <Text style={styles.noDataText}>No spinal manipulation record data available</Text>}
    {records.map((record, recordIndex) => <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
      <View wrap={false}><Text style={styles.recordTitle}>Spinal Manipulation Record {recordIndex + 1}</Text></View>
      {SECTIONS.map(section => renderSection(record, section))}
    </View>)}
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => pageNumber + ' / ' + totalPages} fixed />
  </Page></Document>;
}
