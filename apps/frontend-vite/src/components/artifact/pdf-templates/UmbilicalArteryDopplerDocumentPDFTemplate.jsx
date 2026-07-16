import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, color: '#000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000' },
  fieldBox: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 3, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666' },
});

const SECTION_FIELDS = {
  'header-info': ['date', 'type', 'provider', 'facility', 'status'],
  'doppler-indices': ['pi', 'ri', 'result', 'results'],
  'clinical-assessment': ['interpretation', 'findings', 'assessment', 'plan', 'notes'],
  'recommendations-section': ['recommendations'],
};
const SECTION_TITLES = { 'header-info': 'Header Information', 'doppler-indices': 'Doppler Indices', 'clinical-assessment': 'Clinical Assessment', 'recommendations-section': 'Recommendations' };
const FIELD_LABELS = { date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status', result: 'Result', pi: 'Pulsatility Index (PI)', ri: 'Resistance Index (RI)', results: 'Results', interpretation: 'Interpretation', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes', recommendations: 'Recommendations' };
const DATE_FIELDS = new Set(['date']);
const safeString = value => { if (value === null || value === undefined) return ''; return String(value).replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"'); };
const hasVal = value => value !== null && value !== undefined && (typeof value === 'boolean' || typeof value === 'number' || (typeof value === 'string' ? value.trim() !== '' : Array.isArray(value) ? value.length > 0 : typeof value === 'object' ? Object.keys(value).length > 0 : true));
const formatDate = value => { try { const date = new Date(value?.$date || value); return Number.isNaN(date.getTime()) ? safeString(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return safeString(value); } };
const humanize = key => String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const splitText = value => String(value || '').split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\d)\.(?:\s+)|;\s+/).map(item => item.trim()).filter(Boolean);
const display = (field, value) => field === 'status' ? ({ normal: 'Normal', abnormal: 'Abnormal', pending: 'Pending', active: 'Active', 'not active': 'Not Active' }[String(value || '').toLowerCase()] || safeString(value)) : DATE_FIELDS.has(field) || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) ? formatDate(value) : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeString(value);
const sameName = (field, sid) => (FIELD_LABELS[field] || field).toLowerCase() === (SECTION_TITLES[sid] || '').toLowerCase();

const scalarUnit = (field, value, sid, key = field) => {
  const shown = display(field, value); const rows = typeof value === 'string' && !DATE_FIELDS.has(field) ? splitText(shown) : [shown];
  return <View key={key} style={styles.fieldBox}><View wrap={false}>{!sameName(field, sid) && <Text style={styles.fieldLabel}>{FIELD_LABELS[field] || humanize(field)}</Text>}<Text style={styles.value}>1. {rows[0]}</Text></View>{rows.slice(1).map((row, index) => <Text key={index} style={styles.value}>{index + 2}. {row}</Text>)}</View>;
};

const fieldUnits = (record, field, sid) => {
  const value = record[field]; if (!hasVal(value)) return [];
  if (field === 'results' && typeof value === 'object' && !Array.isArray(value)) return Object.entries(value).filter(([, leaf]) => hasVal(leaf)).map(([key, leaf]) => <View key={`${field}.${key}`} style={styles.fieldBox} wrap={false}><Text style={styles.fieldLabel}>{humanize(key)}</Text><Text style={styles.value}>1. {display(key, leaf)}</Text></View>);
  if (field === 'recommendations' && Array.isArray(value)) {
    const groups = []; value.forEach((item, index) => { const date = String(item?.date || ''); const group = groups.find(entry => entry.date === date); if (group) group.items.push({ item, index }); else groups.push({ date, items: [{ item, index }] }); });
    return groups.flatMap(group => group.items.map(({ item, index }, itemIndex) => <View key={`${field}.${index}`} style={styles.fieldBox} wrap={false}>{itemIndex === 0 && group.date && <Text style={styles.subLabel}>{formatDate(group.date)}</Text>}<Text style={styles.value}>{itemIndex + 1}. {safeString(item?.recommendation || item)}</Text></View>));
  }
  return [scalarUnit(field, value, sid)];
};

const renderSection = (record, sid) => {
  const units = (SECTION_FIELDS[sid] || []).flatMap(field => fieldUnits(record, field, sid)); if (!units.length) return null;
  return <View key={sid} style={styles.section}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>{units[0]}</View>{units.slice(1)}</View>;
};

const unwrapRecords = source => (Array.isArray(source) ? source : source ? [source] : []).flatMap(record => {
  if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument;
  if (Array.isArray(record?.records || record?._records)) return record.records || record._records;
  if (record?.umbilical_artery_doppler) return Array.isArray(record.umbilical_artery_doppler) ? record.umbilical_artery_doppler : [record.umbilical_artery_doppler];
  if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.umbilical_artery_doppler ? (Array.isArray(record.documentData.umbilical_artery_doppler) ? record.documentData.umbilical_artery_doppler : [record.documentData.umbilical_artery_doppler]) : [record.documentData];
  return [record];
}).filter(record => record && typeof record === 'object');

const UmbilicalArteryDopplerDocumentPDFTemplate = ({ document: docProp, data, templateData }) => {
  const records = unwrapRecords(docProp ?? data ?? templateData);
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Umbilical Artery Doppler</Text>{records.length ? records.map((record, index) => <React.Fragment key={index}><View wrap={false} break={index > 0}><Text style={styles.recordTitle}>Umbilical Artery Doppler {index + 1}</Text></View>{Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}</React.Fragment>) : <Text style={styles.noData}>No umbilical artery Doppler data available.</Text>}<Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text></Page></Document>;
};

export default UmbilicalArteryDopplerDocumentPDFTemplate;
