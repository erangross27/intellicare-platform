/** Treatment Courses - canonical box-free PDF. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginTop: 9, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 4, marginBottom: 2, borderBottomWidth: .5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 1, paddingLeft: 8 },
  noDataText: { fontSize: 14, marginTop: 40 },
});

const SECTION_TITLES = { details: 'Course Details', indication: 'Clinical Indication', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', results: 'Results', notes: 'Notes', followup: 'Follow Up' };
const FIELD_LABELS = { date: 'Date', reportDate: 'Report Date', type: 'Type', reportType: 'Report Type', urgency: 'Urgency', provider: 'Provider', facility: 'Facility', status: 'Status', clinicalIndication: 'Clinical Indication', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', results: 'Results', notes: 'Notes', followUp: 'Follow Up' };
const SECTION_FIELDS = { details: ['date', 'reportDate', 'type', 'reportType', 'urgency', 'provider', 'facility', 'status'], indication: ['clinicalIndication'], findings: ['findings'], assessment: ['assessment'], plan: ['plan'], recommendations: ['recommendations'], results: ['results'], notes: ['notes'], followup: ['followUp'] };
const DATE_FIELDS = new Set(['date', 'reportDate']);

const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.some(hasVal));
const safeString = value => String(value ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...');
const formatDate = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return safeString(value); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return safeString(value); } };
const shouldSplitComma = (before, after) => { const left = before.trim(); const right = after.trimStart(); if (/\d$/.test(left) && /^\d{3}\b/.test(right)) return false; if (/^(?:MD|DO|RN|BSN|NP|PA|PhD|PharmD|FACC|FACP|FACS|MPH|MSN)\b/i.test(right)) return false; if (/^[A-Z]{2}(?:\b|$)/.test(right) && /[A-Za-z ]+$/.test(left)) return false; if (/^(?:and|or)\b/i.test(right)) return false; return true; };
const splitBySentence = text => {
  const source = safeString(text); const clauses = []; let current = ''; let depth = 0;
  const push = () => { if (current.trim()) clauses.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(' || char === '[' || char === '{') { depth += 1; current += char; continue; }
    if (char === ')' || char === ']' || char === '}') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (depth === 0 && char === ';') { push(); while (/\s/.test(source[index + 1] || '')) index += 1; continue; }
    if (depth === 0 && char === ',' && shouldSplitComma(current, source.slice(index + 1))) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; continue; }
    if (depth === 0 && char === '.') { const previous = current.trim().match(/([A-Za-z]+)$/)?.[1] || ''; const decimal = /\d$/.test(current) && /^\d/.test(source[index + 1] || ''); const abbreviation = ['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previous); if (!decimal && !abbreviation && (/\s/.test(source[index + 1] || '') || index === source.length - 1)) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; continue; } }
    current += char;
  }
  push(); return clauses;
};
const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record => record?.treatment_courses ? (Array.isArray(record.treatment_courses) ? record.treatment_courses : [record.treatment_courses]) : record?.documentData ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.treatment_courses ? (Array.isArray(record.documentData.treatment_courses) ? record.documentData.treatment_courses : [record.documentData.treatment_courses]) : [record.documentData]) : [record]).filter(record => record && typeof record === 'object');

const TreatmentCoursesDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  const rowsForField = (record, field) => { const value = record[field]; if (!hasVal(value)) return []; if (DATE_FIELDS.has(field)) return [formatDate(value)]; if (field === 'notes') return splitBySentence(value); if (field === 'recommendations') return (Array.isArray(value) ? value : [value]).filter(hasVal).map(safeString); return [safeString(value)]; };
  const fieldBody = (record, field, sectionId) => {
    const values = rowsForField(record, field); if (!values.length) return [];
    const label = FIELD_LABELS[field]; const showLabel = label.toLowerCase() !== SECTION_TITLES[sectionId].toLowerCase();
    const rows = values.map((value, index) => <Text key={`${field}-${index}`} style={styles.listItem}>{index + 1}. {safeString(value)}</Text>);
    if (rows.length <= 6) return [<View key={`${field}-field`} wrap={false}>{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}{rows}</View>];
    const [first, ...rest] = rows; return [<View key={`${field}-field`} wrap={false}>{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}{first}</View>, ...rest];
  };
  const renderSection = (record, sectionId) => { let body = []; SECTION_FIELDS[sectionId].forEach(field => { body = body.concat(fieldBody(record, field, sectionId)); }); if (!body.length) return null; body = body.map((element, index) => React.cloneElement(element, { key: `${sectionId}-${index}` })); const [first, ...rest] = body; return <View key={sectionId}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sectionId]}</Text>{first}</View>{rest}</View>; };
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Treatment Courses</Text>{!records.length && <Text style={styles.noDataText}>No treatment course records available</Text>}{records.map((record, index) => <View key={index} break={index > 0}><Text style={styles.recordTitle}>{`Treatment Course ${index + 1}`}</Text>{Object.keys(SECTION_FIELDS).map(sectionId => renderSection(record, sectionId))}</View>)}</Page></Document>;
};

export default TreatmentCoursesDocumentPDFTemplate;
