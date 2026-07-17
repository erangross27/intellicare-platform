import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 42, paddingBottom: 58, fontFamily: 'Helvetica', color: '#111827', fontSize: 13, lineHeight: 1.35 },
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
  { title: 'Test Information', fields: [['date', 'Date', 'date'], ['testType', 'Test Type'], ['allergist', 'Allergist'], ['facility', 'Facility']] },
  { title: 'Controls', fields: [['controls', 'Controls', 'sentenceComma']] },
  { title: 'Wheal Size', fields: [['whealSize', 'Wheal Size', 'object']] },
  { title: 'Allergens Tested', fields: [['allergensTested', 'Allergens Tested', 'array']] },
  { title: 'Positive Reactions', fields: [['positiveReactions', 'Positive Reactions', 'array']] },
  { title: 'Negative Reactions', fields: [['negativeReactions', 'Negative Reactions', 'array']] },
  { title: 'Medications Withheld', fields: [['medicationWithheld', 'Medications Withheld', 'array']] },
  { title: 'Adverse Reactions', fields: [['adverseReactions', 'Adverse Reactions', 'sentence']] },
  { title: 'Interpretation', fields: [['interpretation', 'Interpretation', 'sentenceComma']] },
  { title: 'Recommendations', fields: [['recommendations', 'Recommendations', 'sentence']] },
  { title: 'Notes', fields: [['notes', 'Notes', 'sentenceComma']] },
];
const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal)) && (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(hasVal));
const humanize = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const safeString = value => String(value ?? '').replace(/μ/g, 'µ');
const isDateObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$date');
const rawDate = value => value?.$date?.$numberLong ?? value?.$date ?? value?.$numberLong ?? value;
const formatDate = value => { if (!value) return ''; try { const raw = rawDate(value), normalized = typeof raw === 'string' && /^-?\d+$/.test(raw) ? Number(raw) : raw, date = new Date(normalized); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const parseLabel = value => { const text = safeString(value), match = text.match(/^([^:]{1,80}):\s+(.+)$/); return match ? { subtitle: match[1].trim(), content: match[2].trim() } : { subtitle: '', content: text }; };
const splitComma = value => { const rows = []; let current = '', depth = 0; for (const char of safeString(value)) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; } else current += char; } if (current.trim()) rows.push(current.trim()); return rows; };
const splitSentence = value => safeString(value).split(/;\s+|(?<!\b[A-Z])\.(?!\d)(?:\s+|$)/).map(row => row.trim()).filter(row => row && !/^[;.,!?]+$/.test(row));
const textRows = (value, { sentences = false, commas = false } = {}) => (sentences ? splitSentence(value) : [safeString(value).trim()]).flatMap(part => { const parsed = parseLabel(part), clauses = commas ? splitComma(parsed.content) : [parsed.content]; return clauses.filter(Boolean).map(row => ({ subtitle: parsed.subtitle, value: row })); });
const flattenObject = (value, prefix = '', labelPrefix = '') => {
  if (Array.isArray(value)) return value.flatMap((child, index) => { const path = prefix ? `${prefix}.${index}` : String(index), label = `${labelPrefix || 'Item'} ${index + 1}`; return child && typeof child === 'object' && !isDateObject(child) ? flattenObject(child, path, label) : hasVal(child) ? [{ path, subtitle: label, value: child }] : []; });
  return Object.entries(value || {}).flatMap(([key, child]) => { const path = prefix ? `${prefix}.${key}` : key, label = labelPrefix ? `${labelPrefix} - ${humanize(key)}` : humanize(key); return child && typeof child === 'object' && !isDateObject(child) ? flattenObject(child, path, label) : hasVal(child) ? [{ path, subtitle: label, value: /date/i.test(key) ? formatDate(child) : typeof child === 'boolean' ? (child ? 'Yes' : 'No') : safeString(child) }] : []; });
};
const rowsFor = ([, , type], value) => {
  if (type === 'date') return [{ value: formatDate(value) }];
  if (type === 'sentence') return textRows(value, { sentences: true });
  if (type === 'sentenceComma') return textRows(value, { sentences: true, commas: true });
  if (type === 'object') return flattenObject(value);
  if (type === 'array') return (Array.isArray(value) ? value : []).flatMap((item, index) => item && typeof item === 'object' && !isDateObject(item) ? flattenObject(item, String(index), `Item ${index + 1}`) : hasVal(item) ? [{ value: safeString(item) }] : []);
  return textRows(value);
};
const sectionEntries = (record, section) => section.fields.flatMap((config, fieldIndex) => { const [field, label] = config, value = record?.[field]; if (!hasVal(value)) return []; return rowsFor(config, value).map((row, fieldRowIndex) => ({ field, fieldIndex, fieldRowIndex, label, row })); });
const renderEntry = (entry, index, previous, sectionTitle, keepTogether = true) => {
  const showFieldLabel = entry.label !== sectionTitle && (!previous || previous.field !== entry.field);
  const showSubtitle = entry.row.subtitle && (!previous || previous.row.subtitle !== entry.row.subtitle);
  const content = <>{showFieldLabel && <View style={styles.fieldHeader}><Text style={styles.fieldLabel}>{entry.label}</Text></View>}{showSubtitle && <Text style={styles.nestedSubtitle}>{entry.row.subtitle}</Text>}<Text style={styles.fieldValue}>{entry.fieldRowIndex + 1}. {entry.row.value}</Text></>;
  if (!keepTogether) return <View key={`${entry.field}-${entry.fieldRowIndex}-${index}`} style={showFieldLabel ? styles.fieldBox : styles.rowBlock}>{content}</View>;
  return <View key={`${entry.field}-${entry.fieldRowIndex}-${index}`} style={showFieldLabel ? styles.fieldBox : styles.rowBlock} wrap={false}>{content}</View>;
};
const unwrap = source => { if (!source) return []; let rows = Array.isArray(source) ? source : [source]; rows = rows.flatMap(row => { if (Array.isArray(row?.records)) return row.records; if (Array.isArray(row?._records)) return row._records; if (row?.allergy_skin_testing) return Array.isArray(row.allergy_skin_testing) ? row.allergy_skin_testing : [row.allergy_skin_testing]; if (row?.documentData) { const nested = row.documentData; if (Array.isArray(nested)) return nested; if (nested?.allergy_skin_testing) return Array.isArray(nested.allergy_skin_testing) ? nested.allergy_skin_testing : [nested.allergy_skin_testing]; return [nested]; } return [row]; }); return rows.filter(row => row && typeof row === 'object'); };

const AllergySkinTestingDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => unwrap(documentProp ?? dataProp ?? templateData), [documentProp, dataProp, templateData]);
  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Allergy Skin Testing</Text></View><Text style={styles.noData}>No allergy skin testing data available</Text></Page></Document>;
  return <Document>{records.map((record, recordIndex) => <Page key={recordIndex} size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Allergy Skin Testing</Text></View><View style={styles.recordHeader}><Text style={styles.recordTitle}>Allergy Skin Testing {recordIndex + 1}</Text></View>{SECTIONS.map(section => { const entries = sectionEntries(record, section); if (!entries.length) return null; return <View key={section.title} style={styles.section}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text>{renderEntry(entries[0], 0, null, section.title, false)}</View>{entries.slice(1).map((entry, index) => renderEntry(entry, index + 1, entries[index], section.title))}</View>; })}</Page>)}</Document>;
};

export default AllergySkinTestingDocumentPDFTemplate;
