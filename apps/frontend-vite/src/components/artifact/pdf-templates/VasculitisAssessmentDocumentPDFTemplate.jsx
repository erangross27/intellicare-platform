import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, color: '#000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666' },
});

const SECTION_TITLES = {
  'record-info': 'Record Information', 'type-scores': 'Type & Scores', 'organ-systems': 'Organ Systems',
  'diagnostic-studies': 'Diagnostic Studies', findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', results: 'Results', notes: 'Notes', 'provider-info': 'Provider Information',
};
const FIELD_LABELS = {
  date: 'Date', status: 'Status', type: 'Type', bvasScore: 'BVAS Score', vdiScore: 'VDI Score',
  organSystems: 'Organ Systems', biopsyResults: 'Biopsy Results', angiographicFindings: 'Angiographic Findings',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', results: 'Results',
  notes: 'Notes', provider: 'Provider', facility: 'Facility',
};
const SECTION_FIELDS = {
  'record-info': ['date', 'status'], 'type-scores': ['type', 'bvasScore', 'vdiScore'], 'organ-systems': ['organSystems'],
  'diagnostic-studies': ['biopsyResults', 'angiographicFindings'], findings: ['findings'], assessment: ['assessment'],
  plan: ['plan'], recommendations: ['recommendations'], results: ['results'], notes: ['notes'], 'provider-info': ['provider', 'facility'],
};
const SECTION_ORDER = Object.keys(SECTION_FIELDS);
const NARRATIVE_FIELDS = new Set(['biopsyResults', 'angiographicFindings', 'findings', 'assessment', 'plan', 'notes']);
const COMMA_ARRAY_FIELDS = new Set(['findings', 'plan']);

const formatDate = value => { if (!value) return ''; try { const date = new Date(value.$date || value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const fmtScalar = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const isEmptyDeep = value => { if (value === null || value === undefined) return true; if (typeof value === 'boolean') return false; if (typeof value === 'number') return !Number.isFinite(value); if (typeof value === 'string') return !value.trim(); if (Array.isArray(value)) return value.every(isEmptyDeep); if (typeof value === 'object') return Object.values(value).every(isEmptyDeep); return false; };
const parseLabel = text => { const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)$/); return match ? { label: match[1].trim(), value: match[2].trim() } : { label: '', value: String(text || '').trim() }; };
const splitBySentence = text => String(text || '').split(/;\s+|(?<!\d)\.(?:\s+)/).map(item => item.trim()).filter(Boolean);
const splitByComma = text => { const values = []; let current = ''; let depth = 0; for (const character of String(text || '')) { if (character === '(') depth += 1; if (character === ')') depth = Math.max(0, depth - 1); if (character === ',' && depth === 0) { if (current.trim()) values.push(current.trim()); current = ''; } else current += character; } if (current.trim()) values.push(current.trim()); return values.length ? values : [String(text || '').trim()]; };
const humanizeKey = key => { const text = String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2'); return text ? text[0].toUpperCase() + text.slice(1) : ''; };
const flattenObject = (value, path = []) => {
  if (isEmptyDeep(value)) return [];
  if (value === null || typeof value !== 'object') return [{ label: humanizeKey(path[path.length - 1]), value: fmtScalar(value) }];
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenObject(item, [...path, String(index)]));
  return Object.entries(value).filter(([, child]) => !isEmptyDeep(child)).flatMap(([key, child]) => flattenObject(child, [...path, key]));
};
const hasValue = (field, value) => field === 'results' ? !isEmptyDeep(value) : field === 'recommendations' || field === 'organSystems' ? Array.isArray(value) && value.some(item => !isEmptyDeep(item)) : !isEmptyDeep(value);
const fieldRows = (field, value) => {
  if (field === 'date') return [{ label: '', value: formatDate(value) }];
  if (field === 'organSystems') return (Array.isArray(value) ? value : []).filter(item => !isEmptyDeep(item)).map(item => ({ label: '', value: fmtScalar(item) }));
  if (field === 'recommendations') return (Array.isArray(value) ? value : []).filter(item => item && (item.recommendation || item.date)).map(item => ({ label: item.date ? formatDate(item.date) : '', value: String(item.recommendation || item.text || '') })).filter(row => row.value);
  if (field === 'results') return flattenObject(value);
  const text = fmtScalar(value);
  if (!NARRATIVE_FIELDS.has(field)) return [{ label: '', value: text }];
  return splitBySentence(text).flatMap(clause => { const parsed = parseLabel(clause); const values = COMMA_ARRAY_FIELDS.has(field) ? splitByComma(parsed.value) : [parsed.value]; return values.map(item => ({ label: parsed.label, value: item })); });
};
const chunk = values => { const chunks = []; for (let index = 0; index < values.length; index += 6) chunks.push(values.slice(index, index + 6)); return chunks; };
const unwrapRecords = source => (Array.isArray(source) ? source : source ? [source] : []).flatMap(record => {
  if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument;
  if (Array.isArray(record?.records || record?._records)) return record.records || record._records;
  if (record?.vasculitis_assessment) return Array.isArray(record.vasculitis_assessment) ? record.vasculitis_assessment : [record.vasculitis_assessment];
  if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.vasculitis_assessment ? (Array.isArray(record.documentData.vasculitis_assessment) ? record.documentData.vasculitis_assessment : [record.documentData.vasculitis_assessment]) : [record.documentData];
  return [record];
}).filter(record => record && typeof record === 'object');

const renderField = (record, field, sectionTitle, firstField) => {
  const rows = fieldRows(field, record[field]); const groups = [];
  rows.forEach(row => { const last = groups[groups.length - 1]; if (last && last.label === row.label) last.values.push(row.value); else groups.push({ label: row.label, values: [row.value] }); });
  const blocks = groups.flatMap(group => chunk(group.values).map((values, index) => ({ label: index === 0 ? group.label : '', values })));
  return blocks.map((block, blockIndex) => <View key={`${field}-${blockIndex}`} wrap={false}>{firstField && blockIndex === 0 && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}{blockIndex === 0 && <Text style={styles.fieldLabel}>{FIELD_LABELS[field] || field}</Text>}{block.label && <Text style={styles.subLabel}>{block.label}</Text>}{block.values.map((rowValue, valueIndex) => <Text key={valueIndex} style={styles.value}>{valueIndex + 1}. {rowValue}</Text>)}</View>);
};

const VasculitisAssessmentDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp ?? data ?? templateData);
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Vasculitis Assessment</Text>{records.length ? records.map((record, recordIndex) => <React.Fragment key={recordIndex}><Text style={styles.recordTitle}>Vasculitis Assessment {recordIndex + 1}</Text>{SECTION_ORDER.map(sectionId => { const fields = SECTION_FIELDS[sectionId].filter(field => hasValue(field, record[field])); if (!fields.length) return null; return <View key={sectionId} style={styles.section}>{fields.flatMap((field, fieldIndex) => renderField(record, field, SECTION_TITLES[sectionId], fieldIndex === 0))}</View>; })}</React.Fragment>) : <Text style={styles.noData}>No vasculitis assessment records available</Text>}<Text fixed style={styles.footer}>Vasculitis Assessment</Text></Page></Document>;
};

export default VasculitisAssessmentDocumentPDFTemplate;
