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
  { title: 'Session Information', fields: [['provider', 'Provider'], ['facility', 'Facility'], ['needed', 'Accommodations Needed', 'boolean'], ['date', 'Date', 'date'], ['type', 'Type']] },
  { title: 'Current Stressors', fields: [['currentStressors', 'Current Stressors', 'array']] },
  { title: 'Recommended Accommodations', fields: [['recommendedAccommodations', 'Recommended Accommodations', 'array']] },
  { title: 'Clinical Details', fields: [['findings', 'Findings', 'sentence'], ['assessment', 'Assessment', 'sentence'], ['plan', 'Plan', 'sentence'], ['leaveStatus', 'Leave Status']] },
  { title: 'Results & Recommendations', fields: [['recommendations', 'Recommendations', 'objectArray'], ['results', 'Results', 'object']] },
  { title: 'Notes', fields: [['notes', 'Notes', 'sentence'], ['status', 'Status']] },
];
const PAGE_GROUPS = [[0, 1], [2, 3], [4, 5]];
const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal)) && (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(hasVal));
const humanize = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const formatDate = value => { if (!value) return ''; try { return new Date(value.$date || value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const parseLabel = value => { const text = String(value || ''), match = text.match(/^([^:]{1,60}):\s+(.+)$/); return match ? { subtitle: match[1].trim(), content: match[2].trim() } : { subtitle: '', content: text }; };
const splitComma = value => { const rows = []; let current = '', depth = 0; for (const char of String(value || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; } else current += char; } if (current.trim()) rows.push(current.trim()); return rows; };
const splitSentence = value => String(value || '').split(/;\s+|(?<!\d)\.(?:\s+|$)/).map(row => row.trim()).filter(row => row && !/^[;.,!?]+$/.test(row));
const flattenObject = (value, prefix = '') => Object.entries(value || {}).flatMap(([key, child]) => { const label = prefix ? `${prefix} — ${humanize(key)}` : humanize(key); if (child && typeof child === 'object' && !Array.isArray(child)) return flattenObject(child, label); return hasVal(child) ? [{ subtitle: label, value: /date$/i.test(key) ? formatDate(child) : typeof child === 'boolean' ? (child ? 'Yes' : 'No') : String(child) }] : []; });
const rowsFor = ([, , type], value) => {
  if (type === 'date') return [{ value: formatDate(value) }]; if (type === 'boolean') return [{ value: value ? 'Yes' : 'No' }]; if (type === 'sentence') return splitSentence(value).map(row => ({ value: row }));
  if (type === 'array') return (Array.isArray(value) ? value : []).flatMap(item => { const parsed = parseLabel(item); return splitComma(parsed.content).map(row => ({ subtitle: parsed.subtitle, value: row })); });
  if (type === 'objectArray') return (Array.isArray(value) ? value : []).flatMap((item, index) => flattenObject(item, `Recommendation ${index + 1}`)); if (type === 'object') return flattenObject(value); return [{ value: String(value) }];
};
const renderField = (config, value, key, sectionTitle) => { const [, label] = config, rows = rowsFor(config, value); let prior = ''; return <React.Fragment key={key}>{label !== sectionTitle && <View style={styles.fieldHeader} wrap={false}><Text style={styles.fieldLabel}>{label}</Text></View>}{rows.map((row, index) => { const showSubtitle = row.subtitle && row.subtitle !== prior; prior = row.subtitle || ''; return <View key={`${key}-${index}`} style={styles.rowBlock} wrap={false}>{showSubtitle && <Text style={styles.nestedSubtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}{'\n'}</Text></View>; })}</React.Fragment>; };

const WorkAccommodationsDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => { const source = documentProp ?? dataProp ?? templateData; if (!source) return []; let rows = Array.isArray(source) ? source : [source]; rows = rows.flatMap(row => { if (Array.isArray(row?.records)) return row.records; if (Array.isArray(row?._records)) return row._records; if (row?.work_accommodations) return Array.isArray(row.work_accommodations) ? row.work_accommodations : [row.work_accommodations]; if (row?.documentData) { const nested = row.documentData; if (Array.isArray(nested)) return nested; if (nested?.work_accommodations) return Array.isArray(nested.work_accommodations) ? nested.work_accommodations : [nested.work_accommodations]; return [nested]; } return [row]; }); return rows.filter(row => row && typeof row === 'object'); }, [documentProp, dataProp, templateData]);
  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Work Accommodations</Text></View><Text style={styles.noData}>No work accommodations available</Text></Page></Document>;
  return <Document>{records.flatMap((record, recordIndex) => PAGE_GROUPS.map((indexes, pageIndex) => { const visible = indexes.map(index => ({ section: SECTIONS[index], index, fields: SECTIONS[index].fields.filter(([field]) => hasVal(record[field])) })).filter(item => item.fields.length); if (!visible.length) return null; return <Page key={`${recordIndex}-${pageIndex}`} size="LETTER" style={styles.page}>{pageIndex === 0 && <View style={styles.documentHeader}><Text style={styles.documentTitle}>Work Accommodations</Text></View>}{pageIndex === 0 && <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Work Accommodations {recordIndex + 1}</Text></View>}{visible.map(({ section, index, fields }) => <View key={section.title} style={styles.section}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text></View>{fields.map((config, fieldIndex) => renderField(config, record[config[0]], `${index}-${fieldIndex}`, section.title))}</View>)}</Page>; }))}</Document>;
};
export default WorkAccommodationsDocumentPDFTemplate;
