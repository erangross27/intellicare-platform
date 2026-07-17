import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 145, paddingHorizontal: 42, paddingBottom: 42, fontFamily: 'Helvetica', color: '#111827', fontSize: 13, lineHeight: 1.35 },
  pageHeader: { position: 'absolute', top: 38, left: 42, right: 42 },
  documentHeader: { marginBottom: 10 },
  documentTitle: { fontSize: 26, fontWeight: 'bold', color: '#0f172a', paddingBottom: 9, borderBottom: '2pt solid #000000' },
  recordHeader: { marginBottom: 10 },
  recordTitle: { fontSize: 19, fontWeight: 'bold', color: '#1e3a8a' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1d4ed8', paddingBottom: 5, borderBottom: '1pt solid #000000' },
  fieldBox: { marginBottom: 9, minHeight: 64 },
  fieldHeader: { marginBottom: 5 },
  fieldLabel: { fontSize: 14, fontWeight: 'bold', color: '#1e3a8a', paddingBottom: 3, borderBottom: '0.5pt solid #999999' },
  rowBlock: { marginLeft: 8, marginBottom: 5 },
  nestedSubtitle: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 3 },
  fieldValue: { fontSize: 13, color: '#111827' },
  noData: { fontSize: 13, marginTop: 20 },
});

const SECTIONS = [
  { title: 'Assessment Details', fields: [['date', 'Date', 'date'], ['type', 'Type'], ['provider', 'Provider'], ['facility', 'Facility'], ['status', 'Status']] },
  { title: 'Immune Function', fields: [['immuneFunction', 'Immune Function', 'object']] },
  { title: 'Skin Testing', fields: [['skinTesting', 'Skin Testing', 'object']] },
  { title: 'Specific IgE', fields: [['specificIge', 'Specific IgE', 'object']] },
  { title: 'Component Testing', fields: [['componentTesting', 'Component Testing', 'object']] },
  { title: 'Challenge Tests', fields: [['challengeTests', 'Challenge Tests', 'object']] },
  { title: 'Findings', fields: [['findings', 'Findings', 'sentenceComma']] },
  { title: 'Assessment', fields: [['assessment', 'Assessment', 'sentenceComma']] },
  { title: 'Plan', fields: [['plan', 'Plan', 'sentenceComma']] },
  { title: 'Recommendations', fields: [['recommendations', 'Recommendations', 'object']] },
  { title: 'Results', fields: [['results', 'Results', 'object']] },
  { title: 'Notes', fields: [['notes', 'Notes', 'sentenceComma']] },
];
const PAGE_GROUPS = SECTIONS.map((_, index) => [index]);
const humanize = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const safeString = value => String(value ?? '').replace(/μ/g, 'µ');
const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal)) && (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(hasVal));
const isDateObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$date');
const formatDate = value => { if (!value) return ''; try { const raw = value?.$date?.$numberLong ?? value?.$date ?? value?.$numberLong ?? value, normalized = typeof raw === 'string' && /^-?\d+$/.test(raw) ? Number(raw) : raw, date = new Date(normalized); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const parseLabel = value => { const text = safeString(value), match = text.match(/^([^:]{1,60}):\s+(.+)$/); return match && !/[([\]]/.test(match[1]) ? { subtitle: match[1].trim(), content: match[2].trim() } : { subtitle: '', content: text }; };
const splitComma = value => { const rows = []; let current = '', depth = 0; for (const char of safeString(value)) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; } else current += char; } if (current.trim()) rows.push(current.trim()); return rows; };
const splitSentence = value => safeString(value).split(/;\s+|(?<!\b[A-Z])\.(?!\d)(?:\s+|$)/).map(row => row.trim()).filter(row => row && !/^[;.,!?]+$/.test(row));
const textRows = (value, { sentences = false, commas = false } = {}) => (sentences ? splitSentence(value) : [safeString(value).trim()]).flatMap(part => { const parsed = parseLabel(part); const clauses = commas ? splitComma(parsed.content) : [parsed.content]; return clauses.filter(Boolean).map(row => ({ subtitle: parsed.subtitle, value: row })); });
const flattenObject = (value, prefix = '', labelPrefix = '') => {
  if (Array.isArray(value)) return value.flatMap((child, index) => { const path = prefix ? `${prefix}.${index}` : String(index), label = `${labelPrefix || 'Item'} ${index + 1}`; return child && typeof child === 'object' && !isDateObject(child) ? flattenObject(child, path, label) : hasVal(child) ? [{ path, subtitle: label, value: child }] : []; });
  return Object.entries(value || {}).flatMap(([key, child]) => { const path = prefix ? `${prefix}.${key}` : key, label = labelPrefix ? `${labelPrefix} — ${humanize(key)}` : humanize(key); return child && typeof child === 'object' && !isDateObject(child) ? flattenObject(child, path, label) : hasVal(child) ? [{ path, subtitle: label, value: /date/i.test(key) ? formatDate(child) : typeof child === 'boolean' ? (child ? 'Yes' : 'No') : safeString(child) }] : []; });
};
const rowsFor = ([, , type], value) => {
  if (type === 'date') return [{ value: formatDate(value) }];
  if (type === 'sentenceComma') return textRows(value, { sentences: true, commas: true });
  if (type === 'object') return flattenObject(value);
  return textRows(value);
};
const renderField = (config, value, key, sectionTitle) => {
  const [, label] = config, rows = rowsFor(config, value), showLabel = label !== sectionTitle;
  if (!rows.length) return null;
  const renderRow = (row, index, priorSubtitle) => <View key={`${key}-${index}`} style={styles.rowBlock} wrap={false}>{row.subtitle && row.subtitle !== priorSubtitle && <Text style={styles.nestedSubtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}</Text></View>;
  const first = rows[0];
  return <React.Fragment key={key}>{showLabel ? <View style={styles.fieldBox} wrap={false}><View style={styles.fieldHeader}><Text style={styles.fieldLabel}>{label}</Text></View><View style={styles.rowBlock}>{first.subtitle && <Text style={styles.nestedSubtitle}>{first.subtitle}</Text>}<Text style={styles.fieldValue}>1. {first.value}</Text></View></View> : renderRow(first, 0, '')}{rows.slice(1).map((row, offset) => renderRow(row, offset + 1, rows[offset].subtitle || ''))}</React.Fragment>;
};
const unwrap = source => {
  if (!source) return [];
  let rows = Array.isArray(source) ? source : [source];
  rows = rows.flatMap(row => { if (Array.isArray(row?.records)) return row.records; if (Array.isArray(row?._records)) return row._records; if (row?.allergy_immunology_assessment) return Array.isArray(row.allergy_immunology_assessment) ? row.allergy_immunology_assessment : [row.allergy_immunology_assessment]; if (row?.documentData) { const nested = row.documentData; if (Array.isArray(nested)) return nested; if (nested?.allergy_immunology_assessment) return Array.isArray(nested.allergy_immunology_assessment) ? nested.allergy_immunology_assessment : [nested.allergy_immunology_assessment]; return [nested]; } return [row]; });
  return rows.filter(row => row && typeof row === 'object');
};

const AllergyImmunologyAssessmentDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => unwrap(documentProp ?? dataProp ?? templateData), [documentProp, dataProp, templateData]);
  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Allergy & Immunology Assessment</Text></View><Text style={styles.noData}>No allergy immunology assessment data available</Text></Page></Document>;
  return <Document>{records.flatMap((record, recordIndex) => PAGE_GROUPS.map((indexes, pageIndex) => { const visible = indexes.map(index => ({ section: SECTIONS[index], index, fields: SECTIONS[index].fields.filter(([field]) => hasVal(record?.[field])) })).filter(item => item.fields.length); if (!visible.length) return null; return <Page key={`${recordIndex}-${pageIndex}`} size="LETTER" style={styles.page}><View style={styles.pageHeader} fixed><View style={styles.documentHeader}><Text style={styles.documentTitle}>Allergy & Immunology Assessment</Text></View><View style={styles.recordHeader}><Text style={styles.recordTitle}>Allergy Immunology Assessment {recordIndex + 1}</Text></View>{visible.map(({ section, index }) => <View key={`header-${index}-${section.title}`} wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text></View>)}</View>{visible.map(({ section, index, fields }) => <View key={`${index}-${section.title}`} style={styles.section}>{fields.map((config, fieldIndex) => renderField(config, record[config[0]], `${index}-${fieldIndex}`, section.title))}</View>)}</Page>; }))}</Document>;
};

export default AllergyImmunologyAssessmentDocumentPDFTemplate;
