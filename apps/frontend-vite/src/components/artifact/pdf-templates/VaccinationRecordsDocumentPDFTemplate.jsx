import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, color: '#000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999' },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666' },
});

const SECTION_TITLES = { 'vaccine-details': 'Vaccine Details', administration: 'Administration', 'product-info': 'Product Information', 'reactions-notes': 'Reactions & Notes' };
const FIELD_LABELS = { vaccine: 'Vaccine', dose: 'Dose', series: 'Series', date: 'Date', site: 'Site', administeredBy: 'Administered By', facility: 'Facility', manufacturer: 'Manufacturer', lotNumber: 'Lot Number', reactions: 'Reactions', notes: 'Notes' };
const SECTION_FIELDS = { 'vaccine-details': ['vaccine', 'dose', 'series', 'date'], administration: ['site', 'administeredBy', 'facility'], 'product-info': ['manufacturer', 'lotNumber'], 'reactions-notes': ['reactions', 'notes'] };
const SECTION_ORDER = Object.keys(SECTION_FIELDS);
const ARRAY_FIELDS = new Set(['facility', 'reactions']);
const hasValue = value => value !== null && value !== undefined && (Array.isArray(value) ? value.some(item => String(item ?? '').trim()) : typeof value === 'string' ? Boolean(value.trim()) : true);
const formatDate = value => { if (!value) return ''; try { const date = new Date(value.$date || value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const splitClauses = value => String(value || '').split(/;\s+|(?<!\d)\.(?:\s+)/).map(item => item.trim()).filter(Boolean);
const unwrapRecords = source => (Array.isArray(source) ? source : source ? [source] : []).flatMap(record => { if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument; if (Array.isArray(record?.records || record?._records)) return record.records || record._records; if (record?.vaccination_records) return Array.isArray(record.vaccination_records) ? record.vaccination_records : [record.vaccination_records]; if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.vaccination_records ? (Array.isArray(record.documentData.vaccination_records) ? record.documentData.vaccination_records : [record.documentData.vaccination_records]) : [record.documentData]; return [record]; }).filter(record => record && typeof record === 'object');
const valuesFor = (field, value) => field === 'date' ? [formatDate(value)] : ARRAY_FIELDS.has(field) ? (Array.isArray(value) ? value : [value]).map(item => String(item)).filter(Boolean) : splitClauses(value);
const renderField = (record, field, title, firstField) => {
  if (!hasValue(record[field])) return [];
  const values = valuesFor(field, record[field]); const blocks = []; for (let i = 0; i < values.length; i += 6) blocks.push(values.slice(i, i + 6));
  return blocks.map((items, blockIndex) => <View key={`${field}-${blockIndex}`} wrap={false}>{firstField && blockIndex === 0 && <Text style={styles.sectionTitle}>{title}</Text>}{blockIndex === 0 && <Text style={styles.fieldLabel}>{FIELD_LABELS[field]}</Text>}{items.map((item, index) => <Text key={index} style={styles.value}>{index + 1}. {item}</Text>)}</View>);
};

const VaccinationRecordsDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp ?? data ?? templateData);
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Vaccination Records</Text>{records.length ? records.map((record, index) => <React.Fragment key={index}><View wrap={false} break={index > 0}><Text style={styles.recordTitle}>Vaccination Record {index + 1}</Text></View>{SECTION_ORDER.map(sectionId => { const present = SECTION_FIELDS[sectionId].filter(field => hasValue(record[field])); if (!present.length) return null; return <View key={sectionId} style={styles.section}>{present.flatMap((field, fieldIndex) => renderField(record, field, SECTION_TITLES[sectionId], fieldIndex === 0))}</View>; })}</React.Fragment>) : <Text style={styles.noData}>No vaccination records available.</Text>}<Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text></Page></Document>;
};

export default VaccinationRecordsDocumentPDFTemplate;
