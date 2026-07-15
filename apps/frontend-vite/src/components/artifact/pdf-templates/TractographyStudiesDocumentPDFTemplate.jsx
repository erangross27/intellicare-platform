/** Tractography Studies — canonical box-free PDF, collection tractography_studies. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginTop: 9, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_TITLES = {
  'header-info': 'Header Information',
  'clinical-indication': 'Clinical Indication',
  'findings-followup': 'Findings & Follow-Up',
  recommendations: 'Recommendations',
};
const FIELD_LABELS = {
  reportDate: 'Report Date', reportType: 'Report Type', urgency: 'Urgency', clinicalIndication: 'Clinical Indication',
  findings: 'Findings', followUp: 'Follow-Up', recommendations: 'Recommendations',
};
const SECTION_FIELDS = {
  'header-info': ['reportDate', 'reportType', 'urgency'],
  'clinical-indication': ['clinicalIndication'],
  'findings-followup': ['findings', 'followUp'],
  recommendations: ['recommendations'],
};
const DATE_FIELDS = new Set(['reportDate']);
const PERIOD_SPLIT_FIELDS = new Set(['clinicalIndication', 'findings', 'recommendations']);
const safeString = value => String(value ?? '').replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '');
const sameAsTitle = (label, sid) => label.trim().toLowerCase() === SECTION_TITLES[sid].trim().toLowerCase();
const formatDate = value => { try { const date = new Date(value?.$date || value); return Number.isNaN(date.getTime()) ? safeString(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return safeString(value); } };
const parseLabel = text => { const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]+)/); return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: String(text || '') }; };
const splitEditableClauses = (value, fieldPath) => {
  const source = String(value ?? ''); const out = []; let current = ''; let depth = 0; const push = () => { if (current.trim()) out.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]; if (character === '(') depth += 1; if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || ''; const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next) && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord) && !/\b[A-Z]$/.test(current) && !/\d$/.test(current);
    const safeSemicolon = character === ';' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0;
    if (safePeriod || safeSemicolon) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; } else current += character;
  }
  push(); return out.length ? out : [source];
};
const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record => {
  if (record?.tractography_studies) return Array.isArray(record.tractography_studies) ? record.tractography_studies : [record.tractography_studies];
  if (record?.documentData) { const inner = record.documentData; if (Array.isArray(inner)) return inner; if (inner?.tractography_studies) return Array.isArray(inner.tractography_studies) ? inner.tractography_studies : [inner.tractography_studies]; return [inner]; }
  return [record];
}).filter(record => record && typeof record === 'object');

const TractographyStudiesDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  const fieldBody = (record, fn, sid) => {
    const value = record[fn]; if (!hasVal(value)) return [];
    const label = FIELD_LABELS[fn] || fn; const elements = [];
    if (DATE_FIELDS.has(fn)) elements.push(<Text key={`${fn}-date`} style={styles.listItem}>1. {formatDate(value)}</Text>);
    else { let rowNumber = 1; splitEditableClauses(value, fn).forEach((clause, clauseIndex) => { const parsed = parseLabel(clause); if (parsed.isLabeled) elements.push(<Text key={`${fn}-${clauseIndex}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>); elements.push(<Text key={`${fn}-${clauseIndex}`} style={styles.listItem}>{rowNumber++}. {safeString(parsed.isLabeled ? parsed.value : clause)}</Text>); }); }
    if (!sameAsTitle(label, sid) && elements.length) { const [first, ...rest] = elements; return [<View key={`${fn}-head`} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text>{first}</View>, ...rest]; }
    return elements;
  };
  const renderSection = (record, sid) => { let body = []; SECTION_FIELDS[sid].forEach(fn => { body = body.concat(fieldBody(record, fn, sid)); }); if (!body.length) return null; body = body.map((element, index) => React.cloneElement(element, { key: `${sid}-${index}` })); const [first, ...rest] = body; return <View key={sid}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>{first}</View>{rest}</View>; };
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Tractography Studies</Text>{records.length === 0 && <Text style={styles.noDataText}>No tractography studies records available</Text>}{records.map((record, index) => <View key={index} break={index > 0}><Text style={styles.recordTitle}>{`Tractography Study ${index + 1}`}</Text>{Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}</View>)}</Page></Document>;
};

export default TractographyStudiesDocumentPDFTemplate;
