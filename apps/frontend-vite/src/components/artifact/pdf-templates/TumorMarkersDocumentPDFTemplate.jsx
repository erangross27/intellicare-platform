import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 20, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 14, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 8, paddingLeft: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 3 },
  value: { fontSize: 14, lineHeight: 1.4, paddingLeft: 8, marginBottom: 3 },
  noData: { fontSize: 14, textAlign: 'center', color: '#666666', marginTop: 40 },
});

const SECTION_TITLES = {
  'header-info': 'Header Information',
  'standard-markers': 'Standard Markers',
  'other-markers': 'Other Markers',
  'clinical-assessment': 'Clinical Assessment',
  'treatment-plan': 'Treatment Plan',
  'results-data': 'Results',
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status',
  cea: 'CEA', ca199: 'CA 19-9', ca125: 'CA 125', afp: 'AFP', psa: 'PSA', ldh: 'LDH', alkalinePhosphatase: 'Alkaline Phosphatase',
  otherMarkers: 'Other Markers', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', notes: 'Notes', results: 'Results',
};
const SECTION_FIELDS = {
  'header-info': ['date', 'type', 'provider', 'facility', 'status'],
  'standard-markers': ['cea', 'ca199', 'ca125', 'afp', 'psa', 'ldh', 'alkalinePhosphatase'],
  'other-markers': ['otherMarkers'],
  'clinical-assessment': ['findings', 'assessment'],
  'treatment-plan': ['plan', 'recommendations', 'notes'],
  'results-data': ['results'],
};
const DATE_FIELDS = new Set(['date']);
const COMMA_SPLIT_FIELDS = new Set(['findings']);

const hasVal = value => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.length > 0) && (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0);
const safeString = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replace(/\u03BC/g, 'u').replace(/\u00D7/g, 'x').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
};
const formatDate = value => { try { const date = new Date(value?.$date || value); return Number.isNaN(date.getTime()) ? safeString(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return safeString(value); } };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const formatMonth = value => { const match = String(value || '').match(/^(\d{4})-(\d{2})$/); return match ? `${MONTHS[Number(match[2]) - 1] || match[2]} ${match[1]}` : safeString(value); };
const leafDisplay = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) ? formatMonth(value) : safeString(value);
const splitByComma = text => {
  const parts = []; let current = ''; let depth = 0;
  for (const char of String(text || '')) {
    if ('([{'.includes(char)) depth += 1; else if (')]}'.includes(char)) depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; } else current += char;
  }
  if (current.trim()) parts.push(current.trim()); return parts;
};
const splitText = (value, field) => {
  const clauses = String(value || '').split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\d)\.(?:\s+)|;\s+/).map(item => item.trim()).filter(Boolean);
  return COMMA_SPLIT_FIELDS.has(field) ? clauses.flatMap(splitByComma) : clauses;
};
const humanize = key => String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const sameName = (field, sid) => (FIELD_LABELS[field] || field).toLowerCase() === (SECTION_TITLES[sid] || '').toLowerCase();

const scalarUnit = (field, value, sid, key = field) => {
  const label = FIELD_LABELS[field] || humanize(field);
  const display = field === 'status' ? ({ active: 'Active', complete: 'Complete', normal: 'Normal', baseline: 'Baseline', 'not active': 'Not Active' }[String(value || '').toLowerCase()] || safeString(value)) : DATE_FIELDS.has(field) ? formatDate(value) : safeString(value);
  const rows = typeof value === 'string' && !DATE_FIELDS.has(field) ? splitText(display, field) : [display];
  return <View key={key} style={styles.fieldBox}><View wrap={false}>{!sameName(field, sid) && <Text style={styles.fieldLabel}>{label}</Text>}<Text style={styles.value}>1. {rows[0] || display}</Text></View>{rows.slice(1).map((row, index) => <Text key={index} style={styles.value}>{index + 2}. {row}</Text>)}</View>;
};

const fieldUnits = (record, field, sid) => {
  const value = record[field]; if (!hasVal(value)) return [];
  if (field === 'otherMarkers' && Array.isArray(value)) {
    return value.flatMap((item, index) => typeof item === 'object' && item !== null ? Object.entries(item).filter(([, leaf]) => hasVal(leaf)).map(([key, leaf], leafIndex) => <View key={`${field}.${index}.${key}`} style={styles.fieldBox} wrap={false}>{leafIndex === 0 && <Text style={styles.subLabel}>Marker {index + 1}</Text>}<Text style={styles.fieldLabel}>{humanize(key)}</Text><Text style={styles.value}>1. {leafDisplay(leaf)}</Text></View>) : [scalarUnit(field, item, sid, `${field}.${index}`)]);
  }
  if (field === 'recommendations' && Array.isArray(value)) {
    const groups = [];
    value.forEach((item, index) => { const date = String(item?.date || ''); const existing = groups.find(group => group.date === date); if (existing) existing.items.push({ item, index }); else groups.push({ date, items: [{ item, index }] }); });
    return groups.flatMap(group => group.items.map(({ item, index }, itemIndex) => <View key={`${field}.${index}`} style={styles.fieldBox} wrap={false}>{itemIndex === 0 && group.date && <Text style={styles.subLabel}>{leafDisplay(group.date)}</Text>}<Text style={styles.value}>{itemIndex + 1}. {safeString(item?.recommendation || item)}</Text></View>));
  }
  if (field === 'results' && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).filter(([, leaf]) => hasVal(leaf)).map(([key, leaf]) => <View key={`${field}.${key}`} style={styles.fieldBox} wrap={false}><Text style={styles.fieldLabel}>{humanize(key)}</Text><Text style={styles.value}>1. {leafDisplay(leaf)}</Text></View>);
  }
  return [scalarUnit(field, value, sid)];
};

const renderSection = (record, sid) => {
  const units = (SECTION_FIELDS[sid] || []).flatMap(field => fieldUnits(record, field, sid)); if (!units.length) return null;
  return <View key={sid} style={styles.section}><View wrap={false}>{sid === 'results-data' ? <Text style={styles.sectionTitle}>Results</Text> : <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>}{units[0]}</View>{units.slice(1)}</View>;
};

const unwrapRecords = source => (Array.isArray(source) ? source : source ? [source] : []).flatMap(record => {
  if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument;
  if (Array.isArray(record?.records || record?._records)) return record.records || record._records;
  if (record?.tumor_markers) return Array.isArray(record.tumor_markers) ? record.tumor_markers : [record.tumor_markers];
  if (record?.data?.tumor_markers) return Array.isArray(record.data.tumor_markers) ? record.data.tumor_markers : [record.data.tumor_markers];
  if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.tumor_markers ? (Array.isArray(record.documentData.tumor_markers) ? record.documentData.tumor_markers : [record.documentData.tumor_markers]) : [record.documentData];
  return [record];
}).filter(record => record && typeof record === 'object');

const TumorMarkersDocumentPDFTemplate = ({ document: docProp, data, templateData }) => {
  const records = unwrapRecords(docProp ?? data ?? templateData);
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Tumor Markers</Text>{records.length ? records.map((record, index) => <React.Fragment key={index}><View wrap={false} break={index > 0}><Text style={styles.recordTitle}>Tumor Markers {index + 1}</Text></View>{Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}</React.Fragment>) : <Text style={styles.noData}>No tumor markers data available.</Text>}</Page></Document>;
};

export default TumorMarkersDocumentPDFTemplate;
