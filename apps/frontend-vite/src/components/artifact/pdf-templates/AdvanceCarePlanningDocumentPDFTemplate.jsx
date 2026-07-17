import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 38, paddingBottom: 42, paddingHorizontal: 42, fontFamily: 'Helvetica', color: '#111827', fontSize: 14 },
  documentHeader: { marginBottom: 18 }, documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  recordHeader: { marginBottom: 16 }, recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 11, flexDirection: 'column', width: 528 }, sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, marginBottom: 7, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginTop: 4, marginBottom: 8, flexDirection: 'column', width: 528 }, fieldHeader: { marginTop: 8, marginBottom: 6, width: 528 }, fieldLabel: { width: 528, fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  nestedSubtitle: { width: 528, fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 6, color: '#1d4ed8' }, rowBlock: { width: 528, alignSelf: 'stretch', minHeight: 24, marginBottom: 8, flexDirection: 'column' }, fieldValue: { width: 528, fontSize: 14, lineHeight: 1.45 }, noData: { fontSize: 14, color: '#6b7280', marginTop: 16 },
});
const SECTIONS = [
  { title: 'Planning Overview', fields: [['planningDate', 'Planning Date', 'date'], ['participants', 'Participants', 'arrayKeep'], ['provider', 'Provider'], ['facility', 'Facility']] },
  { title: 'Goals & Values', fields: [['goalsOfCare', 'Goals of Care', 'sentence'], ['values', 'Values', 'sentenceComma']] },
  { title: 'Quality of Life', fields: [['qualityOfLife', 'Quality of Life', 'sentenceComma']] },
  { title: 'Treatment Preferences', fields: [['codeStatus', 'Code Status'], ['treatmentPreferences', 'Treatment Preferences', 'sentence']] },
  { title: 'Directives & Healthcare Agent', fields: [['healthcareAgent', 'Healthcare Agent'], ['advanceDirectiveStatus', 'Advance Directive Status', 'sentence']] },
  { title: 'Prognosis & Spiritual Concerns', fields: [['prognosisDiscussion', 'Prognosis Discussion', 'sentence'], ['spiritualConcerns', 'Spiritual Concerns', 'sentence']] },
  { title: 'Follow-up & Notes', fields: [['followUpPlanned', 'Follow-up Planned'], ['notes', 'Notes', 'sentence']] },
];
const PAGE_GROUPS = SECTIONS.map((_, index) => [index]);
const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal)) && (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(hasVal));
const humanize = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const formatDate = value => { if (!value) return ''; try { const raw = value?.$date?.$numberLong ?? value?.$date ?? value?.$numberLong ?? value, normalized = typeof raw === 'string' && /^-?\d+$/.test(raw) ? Number(raw) : raw, date = new Date(normalized); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const parseLabel = value => { const text = String(value || ''), match = text.match(/^([^:]{1,60}):\s+(.+)$/); return match && !/[([\]]/.test(match[1]) ? { subtitle: match[1].trim(), content: match[2].trim() } : { subtitle: '', content: text }; };
const splitComma = value => { const rows = []; let current = '', depth = 0; for (const char of String(value || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; } else current += char; } if (current.trim()) rows.push(current.trim()); return rows; };
const splitSentence = value => String(value || '').split(/;\s+|\.(?!\d)(?:\s+|$)/).map(row => row.trim()).filter(row => row && !/^[;.,!?]+$/.test(row));
const textRows = (value, { sentences = false, commas = false, commasWhenLabeled = false } = {}) => { const source = String(value || '').trim(); return (sentences ? splitSentence(source) : [source]).flatMap(part => { const parsed = parseLabel(part), clauses = commas && (!commasWhenLabeled || parsed.subtitle) ? splitComma(parsed.content) : [parsed.content]; return clauses.filter(Boolean).map(row => ({ subtitle: parsed.subtitle, value: row })); }); };
const SENTENCE_OBJECT_PATHS = new Set();
const COMMA_OBJECT_PATHS = new Set();
const normalizeIndexedPath = path => path.replace(/\.\d+(?=\.|$)/g, '.*');
const pathIsDeclared = (set, path) => set.has(path) || set.has(normalizeIndexedPath(path));
const isDatePath = path => /date/i.test(String(path || '').split('.').pop());
const isDateObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$date');
const EXTENDED_NUMBER_KEYS = ['$numberInt', '$numberLong', '$numberDouble', '$numberDecimal'];
const isExtendedNumberObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && EXTENDED_NUMBER_KEYS.includes(Object.keys(value)[0]);
const unwrapExtendedNumber = value => { if (!isExtendedNumberObject(value)) return value; const raw = value[Object.keys(value)[0]], number = Number(raw); return Number.isFinite(number) ? number : raw; };
const OBJECT_ARRAY_ITEM_LABELS = {};
const flattenObject = (value, pathPrefix = '', labelPrefix = '') => {
  if (Array.isArray(value)) return value.flatMap((child, index) => {
    const path = pathPrefix ? `${pathPrefix}.${index}` : String(index), label = `${labelPrefix || 'Item'} ${index + 1}`;
    return child && typeof child === 'object' && !isDateObject(child) && !isExtendedNumberObject(child) ? flattenObject(child, path, label) : hasVal(child) ? [{ path, subtitle: label, value: unwrapExtendedNumber(child) }] : [];
  });
  return Object.entries(value || {}).flatMap(([key, child]) => {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key, label = labelPrefix ? `${labelPrefix} — ${humanize(key)}` : humanize(key);
    return child && typeof child === 'object' && !isDateObject(child) && !isExtendedNumberObject(child) ? flattenObject(child, path, label) : hasVal(child) ? [{ path, subtitle: label, value: unwrapExtendedNumber(child) }] : [];
  });
};
const formatLeaf = leaf => ({ subtitle: leaf.subtitle, value: isDatePath(leaf.path) ? formatDate(leaf.value) : typeof leaf.value === 'boolean' ? (leaf.value ? 'Yes' : 'No') : String(leaf.value) });
const objectLeafRows = (field, leaf, subtitlePrefix = '') => {
  const path = `${field}.${leaf.path}`, subtitle = subtitlePrefix ? `${subtitlePrefix} — ${leaf.subtitle}` : leaf.subtitle;
  if (typeof leaf.value === 'string' && (pathIsDeclared(SENTENCE_OBJECT_PATHS, path) || pathIsDeclared(COMMA_OBJECT_PATHS, path))) return textRows(leaf.value, { sentences: pathIsDeclared(SENTENCE_OBJECT_PATHS, path), commas: pathIsDeclared(COMMA_OBJECT_PATHS, path) }).map(row => ({ ...row, subtitle: row.subtitle ? `${subtitle} — ${row.subtitle}` : subtitle }));
  return [{ ...formatLeaf({ ...leaf, subtitle }), path }];
};
const rowsFor = ([field, , type], value) => {
  if (type === 'date') return [{ value: formatDate(value) }]; if (type === 'boolean') return [{ value: value ? 'Yes' : 'No' }]; if (type === 'number') return [{ value: String(value) }]; if (type === 'sentence') return textRows(value, { sentences: true }); if (type === 'sentenceComma') return textRows(value, { sentences: true, commas: true }); if (type === 'sentenceLabeledComma') return textRows(value, { sentences: true, commas: true, commasWhenLabeled: true }); if (type === 'comma') return textRows(value, { commas: true });
  if (type === 'recommendationGroups') { const groups = []; (Array.isArray(value) ? value : []).forEach(item => { if (!hasVal(item)) return; const dateValue = item && typeof item === 'object' ? item.date : null, dateKey = dateValue ? formatDate(dateValue) : 'no-date'; let group = groups.find(candidate => candidate.dateKey === dateKey); if (!group) { group = { dateKey, dateValue, items: [] }; groups.push(group); } group.items.push(item); }); return groups.flatMap(group => { const rows = []; if (group.dateValue) rows.push({ subtitle: 'Date', value: formatDate(group.dateValue) }); group.items.forEach(item => { const objectItem = item && typeof item === 'object', raw = objectItem ? (item.recommendation ?? item.text ?? item.value) : item; if (hasVal(raw)) rows.push({ value: String(raw) }); }); return rows; }); }
  if (type === 'arrayConditional') return (Array.isArray(value) ? value : []).flatMap(item => { const parsed = parseLabel(item); return parsed.subtitle ? textRows(item, { commas: true }) : [{ value: String(item) }]; });
  if (type === 'arrayKeep') return (Array.isArray(value) ? value : []).map(item => ({ value: String(item) }));
  if (type === 'arrayComma') return (Array.isArray(value) ? value : []).flatMap(item => textRows(item, { commas: true }));
  if (type === 'arrayLabeledKeep') return (Array.isArray(value) ? value : []).map(item => { const parsed = parseLabel(item); return { subtitle: parsed.subtitle, value: parsed.content }; });
  if (type === 'objectSplit') return flattenObject(value).flatMap(leaf => leaf.path === 'description' && typeof leaf.value === 'string' ? textRows(leaf.value, { sentences: true, commas: true }).map(row => ({ ...row, subtitle: row.subtitle ? `${leaf.subtitle} — ${row.subtitle}` : leaf.subtitle })) : [formatLeaf(leaf)]);
  if (type === 'objectArray') return (Array.isArray(value) ? value : []).flatMap((item, index) => flattenObject(item).flatMap(leaf => objectLeafRows(`${field}.${index}`, leaf, `${OBJECT_ARRAY_ITEM_LABELS[field]} ${index + 1}`)));
  if (type === 'object') return flattenObject(value).flatMap(leaf => objectLeafRows(field, leaf)); return textRows(value);
};
const renderField = (config, value, key, sectionTitle) => {
  const [, label] = config, rows = rowsFor(config, value), showLabel = label !== sectionTitle;
  if (!rows.length) return null;
  const renderRow = (row, index, priorSubtitle) => { const showSubtitle = row.subtitle && row.subtitle !== priorSubtitle; return <View key={`${key}-${index}`} style={styles.rowBlock} wrap={false}>{showSubtitle && <Text style={styles.nestedSubtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}{'\n'}</Text></View>; };
  const first = rows[0];
  return <React.Fragment key={key}>{showLabel ? <View wrap={false}><View style={styles.fieldHeader}><Text style={styles.fieldLabel}>{label}</Text></View>{renderRow(first, 0, '')}</View> : renderRow(first, 0, '')}{rows.slice(1).map((row, offset) => renderRow(row, offset + 1, rows[offset].subtitle || ''))}</React.Fragment>;
};

const AdvanceCarePlanningDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => { const source = documentProp ?? dataProp ?? templateData; if (!source) return []; let rows = Array.isArray(source) ? source : [source]; rows = rows.flatMap(row => { if (Array.isArray(row?.records)) return row.records; if (Array.isArray(row?._records)) return row._records; if (row?.advance_care_planning) return Array.isArray(row.advance_care_planning) ? row.advance_care_planning : [row.advance_care_planning]; if (row?.documentData) { const nested = row.documentData; if (Array.isArray(nested)) return nested; if (nested?.advance_care_planning) return Array.isArray(nested.advance_care_planning) ? nested.advance_care_planning : [nested.advance_care_planning]; return [nested]; } return [row]; }); return rows.filter(row => row && typeof row === 'object'); }, [documentProp, dataProp, templateData]);
  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Advance Care Planning</Text></View><Text style={styles.noData}>No advance care planning records available</Text></Page></Document>;
  return <Document>{records.flatMap((record, recordIndex) => PAGE_GROUPS.map((indexes, pageIndex) => { const visible = indexes.map(index => ({ section: SECTIONS[index], index, fields: SECTIONS[index].fields.filter(([field]) => hasVal(record[field])) })).filter(item => item.fields.length); if (!visible.length) return null; return <Page key={`${recordIndex}-${pageIndex}`} size="LETTER" style={styles.page}>{pageIndex === 0 && <View style={styles.documentHeader}><Text style={styles.documentTitle}>Advance Care Planning</Text></View>}{pageIndex === 0 && <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>{record.provider || `Advance Care Planning Record ${recordIndex + 1}`}</Text></View>}{visible.map(({ section, index, fields }) => <View key={`${index}-${section.title}`} style={styles.section}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text></View>{fields.map((config, fieldIndex) => renderField(config, record[config[0]], `${index}-${fieldIndex}`, section.title))}</View>)}</Page>; }))}</Document>;
};
export default AdvanceCarePlanningDocumentPDFTemplate;
