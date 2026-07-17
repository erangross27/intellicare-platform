import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 38, paddingBottom: 42, paddingHorizontal: 42, fontFamily: 'Helvetica', color: '#111827', fontSize: 14 },
  documentHeader: { marginBottom: 18 }, documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  recordHeader: { marginBottom: 16 }, recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 11, flexDirection: 'column', width: 528 }, sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, marginBottom: 7, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginTop: 4, marginBottom: 8, flexDirection: 'column', width: 528 }, fieldHeader: { marginTop: 4, marginBottom: 4, width: 528 }, fieldLabel: { width: 528, fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  nestedSubtitle: { width: 528, fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2, marginBottom: 2, color: '#1d4ed8' }, rowBlock: { width: 528, alignSelf: 'stretch', minHeight: 20, marginBottom: 4, flexDirection: 'column' }, fieldValue: { width: 528, fontSize: 14, lineHeight: 1.35 }, noData: { fontSize: 14, color: '#6b7280', marginTop: 16 },
});
const SECTIONS = [
  { title: 'Wound Identification', fields: [['woundIdentification', 'Wound Identification', 'object']] },
  { title: 'Wound Classification', fields: [['woundClassification', 'Wound Classification', 'object']] },
  { title: 'Wound Measurements', fields: [['woundMeasurements', 'Wound Measurements', 'objectArray']] },
  { title: 'Wound Bed Characteristics', fields: [['woundBedCharacteristics', 'Wound Bed Characteristics', 'object']] },
  { title: 'Exudate', fields: [['exudate', 'Exudate', 'object']] },
  { title: 'Periwound Skin', fields: [['periwoundSkin', 'Periwound Skin', 'object']] },
  { title: 'Infection Assessment', fields: [['infectionAssessment', 'Infection Assessment', 'object']] },
  { title: 'Vascular Assessment', fields: [['vascularAssessment', 'Vascular Assessment', 'object']] },
  { title: 'Neuropathy Assessment', fields: [['neuropathyAssessment', 'Neuropathy Assessment', 'object']] },
  { title: 'Debridement', fields: [['debridement', 'Debridement', 'objectArray']] },
  { title: 'Dressing Regimen', fields: [['dressingRegimen', 'Dressing Regimen', 'object']] },
  { title: 'Off-loading', fields: [['offloading', 'Off-loading', 'object']] },
  { title: 'Adjunctive Therapies', fields: [['adjunctiveTherapies', 'Adjunctive Therapies', 'arrayKeep']] },
  { title: 'Healing Progress', fields: [['healingProgress', 'Healing Progress', 'objectArray']] },
  { title: 'Amputation Risk', fields: [['amputationRisk', 'Amputation Risk', 'object']] },
  { title: 'Patient Education', fields: [['patientEducation', 'Patient Education', 'object']] },
  { title: 'Assessment Date', fields: [['date', 'Assessment Date', 'date']] },
];
const PAGE_GROUPS = SECTIONS.map((_, index) => [index]);
const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal)) && (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(hasVal));
const humanize = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const formatDate = value => { if (!value) return ''; try { return new Date(value.$date || value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const parseLabel = value => { const text = String(value || ''), match = text.match(/^([^:]{1,60}):\s+(.+)$/); return match ? { subtitle: match[1].trim(), content: match[2].trim() } : { subtitle: '', content: text }; };
const splitComma = value => { const rows = []; let current = '', depth = 0; for (const char of String(value || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; } else current += char; } if (current.trim()) rows.push(current.trim()); return rows; };
const splitSentence = value => String(value || '').split(/;\s+|\.(?!\d)(?:\s+|$)/).map(row => row.trim()).filter(row => row && !/^[;.,!?]+$/.test(row));
const textRows = (value, { sentences = false, commas = false, commasWhenLabeled = false } = {}) => (sentences ? splitSentence(value) : [String(value || '').trim()]).flatMap(part => { const parsed = parseLabel(part), clauses = commas && (!commasWhenLabeled || parsed.subtitle) ? splitComma(parsed.content) : [parsed.content]; return clauses.filter(Boolean).map(row => ({ subtitle: parsed.subtitle, value: row })); });
const SENTENCE_OBJECT_PATHS = new Set(['infectionAssessment.cultures.*.sensitivities', 'dressingRegimen.moistureManagement', 'amputationRisk.limbSalvagePlan']);
const COMMA_OBJECT_PATHS = new Set(['dressingRegimen.dressingFrequency']);
const normalizeIndexedPath = path => path.replace(/\.\d+(?=\.|$)/g, '.*');
const pathIsDeclared = (set, path) => set.has(path) || set.has(normalizeIndexedPath(path));
const isDatePath = path => /date/i.test(String(path || '').split('.').pop());
const isDateObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$date');
const OBJECT_ARRAY_ITEM_LABELS = { woundMeasurements: 'Wound Measurement', debridement: 'Debridement', healingProgress: 'Healing Assessment' };
const flattenObject = (value, pathPrefix = '', labelPrefix = '') => {
  if (Array.isArray(value)) return value.flatMap((child, index) => {
    const path = pathPrefix ? `${pathPrefix}.${index}` : String(index), label = `${labelPrefix || 'Item'} ${index + 1}`;
    return child && typeof child === 'object' && !isDateObject(child) ? flattenObject(child, path, label) : hasVal(child) ? [{ path, subtitle: label, value: child }] : [];
  });
  return Object.entries(value || {}).flatMap(([key, child]) => {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key, label = labelPrefix ? `${labelPrefix} — ${humanize(key)}` : humanize(key);
    return child && typeof child === 'object' && !isDateObject(child) ? flattenObject(child, path, label) : hasVal(child) ? [{ path, subtitle: label, value: child }] : [];
  });
};
const formatLeaf = leaf => ({ subtitle: leaf.subtitle, value: isDatePath(leaf.path) ? formatDate(leaf.value) : typeof leaf.value === 'boolean' ? (leaf.value ? 'Yes' : 'No') : String(leaf.value) });
const objectLeafRows = (field, leaf, subtitlePrefix = '') => {
  const path = `${field}.${leaf.path}`, subtitle = subtitlePrefix ? `${subtitlePrefix} — ${leaf.subtitle}` : leaf.subtitle;
  if (typeof leaf.value === 'string' && (pathIsDeclared(SENTENCE_OBJECT_PATHS, path) || pathIsDeclared(COMMA_OBJECT_PATHS, path))) return textRows(leaf.value, { sentences: pathIsDeclared(SENTENCE_OBJECT_PATHS, path), commas: pathIsDeclared(COMMA_OBJECT_PATHS, path) }).map(row => ({ ...row, subtitle: row.subtitle ? `${subtitle} — ${row.subtitle}` : subtitle }));
  return [{ ...formatLeaf({ ...leaf, subtitle }), path }];
};
const rowsFor = ([field, , type], value) => {
  if (type === 'date') return [{ value: formatDate(value) }]; if (type === 'boolean') return [{ value: value ? 'Yes' : 'No' }]; if (type === 'number') return [{ value: String(value) }]; if (type === 'sentence') return textRows(value, { sentences: true }); if (type === 'sentenceComma') return textRows(value, { sentences: true, commas: true }); if (type === 'comma') return textRows(value, { commas: true });
  if (type === 'arrayConditional') return (Array.isArray(value) ? value : []).flatMap(item => { const parsed = parseLabel(item); return parsed.subtitle ? textRows(item, { commas: true }) : [{ value: String(item) }]; });
  if (type === 'arrayKeep') return (Array.isArray(value) ? value : []).map(item => ({ value: String(item) }));
  if (type === 'arrayLabeledKeep') return (Array.isArray(value) ? value : []).map(item => { const parsed = parseLabel(item); return { subtitle: parsed.subtitle, value: parsed.content }; });
  if (type === 'objectSplit') return flattenObject(value).flatMap(leaf => leaf.path === 'description' && typeof leaf.value === 'string' ? textRows(leaf.value, { sentences: true, commas: true }).map(row => ({ ...row, subtitle: row.subtitle ? `${leaf.subtitle} — ${row.subtitle}` : leaf.subtitle })) : [formatLeaf(leaf)]);
  if (type === 'objectArray') return (Array.isArray(value) ? value : []).flatMap((item, index) => flattenObject(item).flatMap(leaf => objectLeafRows(`${field}.${index}`, leaf, `${OBJECT_ARRAY_ITEM_LABELS[field]} ${index + 1}`)));
  if (type === 'object') return flattenObject(value).flatMap(leaf => objectLeafRows(field, leaf)); return [{ value: String(value) }];
};
const renderField = (config, value, key, sectionTitle) => { const [, label] = config, rows = rowsFor(config, value); let prior = ''; return <React.Fragment key={key}>{label !== sectionTitle && <View style={styles.fieldHeader} wrap={false}><Text style={styles.fieldLabel}>{label}</Text></View>}{rows.map((row, index) => { const showSubtitle = row.subtitle && row.subtitle !== prior; prior = row.subtitle || ''; return <View key={`${key}-${index}`} style={styles.rowBlock} wrap={false}>{showSubtitle && <Text style={styles.nestedSubtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}{'\n'}</Text></View>; })}</React.Fragment>; };

const WoundCareAssessmentsDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => { const source = documentProp ?? dataProp ?? templateData; if (!source) return []; let rows = Array.isArray(source) ? source : [source]; rows = rows.flatMap(row => { if (Array.isArray(row?.records)) return row.records; if (Array.isArray(row?._records)) return row._records; if (row?.wound_care_assessments) return Array.isArray(row.wound_care_assessments) ? row.wound_care_assessments : [row.wound_care_assessments]; if (row?.documentData) { const nested = row.documentData; if (Array.isArray(nested)) return nested; if (nested?.wound_care_assessments) return Array.isArray(nested.wound_care_assessments) ? nested.wound_care_assessments : [nested.wound_care_assessments]; return [nested]; } return [row]; }); return rows.filter(row => row && typeof row === 'object'); }, [documentProp, dataProp, templateData]);
  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Wound Care Assessments</Text></View><Text style={styles.noData}>No wound care assessments data available</Text></Page></Document>;
  return <Document>{records.flatMap((record, recordIndex) => PAGE_GROUPS.map((indexes, pageIndex) => { const visible = indexes.map(index => ({ section: SECTIONS[index], index, fields: SECTIONS[index].fields.filter(([field]) => hasVal(record[field])) })).filter(item => item.fields.length); if (!visible.length) return null; return <Page key={`${recordIndex}-${pageIndex}`} size="LETTER" style={styles.page}>{pageIndex === 0 && <View style={styles.documentHeader}><Text style={styles.documentTitle}>Wound Care Assessments</Text></View>}{pageIndex === 0 && <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>{record.woundIdentification?.woundNumber || `Wound Care Assessment ${recordIndex + 1}`}</Text></View>}{visible.map(({ section, index, fields }) => <View key={`${index}-${section.title}`} style={styles.section}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text></View>{fields.map((config, fieldIndex) => renderField(config, record[config[0]], `${index}-${fieldIndex}`, section.title))}</View>)}</Page>; }))}</Document>;
};
export default WoundCareAssessmentsDocumentPDFTemplate;
