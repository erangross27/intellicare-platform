import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'basal_rate_adjustments';
const COMMA_SPLIT_FIELDS = [];
const ARRAY_FIELDS = new Set([]);
const NARRATIVE_FIELDS = new Set(['reasonForChange', 'glucosePattern', 'followUpPlan', 'notes']);
const DATE_FIELDS = new Set(['effectiveDate', 'date']);
const LABELS = {
  effectiveDate: 'Effective Date', date: 'Date', provider: 'Provider', facility: 'Facility',
  insulinPumpModel: 'Insulin Pump Model', timeBlock: 'Time Block', oldRate: 'Old Rate',
  newRate: 'New Rate', totalDailyBasal: 'Total Daily Basal', reasonForChange: 'Reason for Change',
  glucosePattern: 'Glucose Pattern', followUpPlan: 'Follow-Up Plan', notes: 'Notes',
};
const SECTIONS = [
  { title: 'Dates', fields: ['effectiveDate', 'date'] },
  { title: 'Record Information', fields: ['provider', 'facility'] },
  { title: 'Pump Information', fields: ['insulinPumpModel'] },
  { title: 'Basal Rate Adjustment', fields: ['timeBlock', 'oldRate', 'newRate', 'totalDailyBasal'] },
  { title: 'Reason and Glucose Pattern', fields: ['reasonForChange', 'glucosePattern'] },
  { title: 'Follow-Up Plan', fields: ['followUpPlan'] },
  { title: 'Notes', fields: ['notes'] },
];
const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.32, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 6, marginBottom: 14 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 2, marginBottom: 6 },
  fieldGroup: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '0.5pt solid #999999', paddingBottom: 1, marginBottom: 3 },
  subtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', marginTop: 3, marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 10 },
  noData: { fontSize: 14, marginTop: 40, textAlign: 'center' },
});
const hasValue = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasValue)) && (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(hasValue));
const isEpochDate = value => /^1970-01-01/.test(String(value?.$date || value || ''));
const formatDate = value => { const raw = value?.$date || value, match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!match) return String(raw || ''); const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`); return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); };
const parseLabel = text => { const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&()'"-]{1,60}?):\s+([\s\S]+)$/); return match ? { subtitle: match[1].trim(), value: match[2].trim() } : { subtitle: '', value: String(text || '').trim() }; };
const splitClauses = (text, splitCommas) => {
  const source = String(text || ''); if (!source.trim()) return []; const output = []; let start = 0; let depth = 0;
  const push = end => { const piece = source.slice(start, end).trim(); if (piece) output.push(piece); };
  for (let index = 0; index < source.length; index += 1) { const character = source[index]; if (character === '(') { depth += 1; continue; } if (character === ')') { depth = Math.max(0, depth - 1); continue; } if (depth) continue; const prefix = source.slice(0, index + 1), suffix = source.slice(index + 1); const protectedPeriod = character === '.' && (/\b(?:Dr|Mr|Mrs|Ms|Prof|Rev|Gen|Col|Sgt|St|Jr|Sr|vs|etc)\.$/.test(prefix) || /(?:^|\s)[A-Z]\.$/.test(prefix) && /^\s+[A-Z][A-Za-z'-]+,\s*(?:MD|DO|PhD|PharmD|PA|RN|NP|DDS|DMD|DVM|JD|FACP|FCAP|FACS|MPH|MBA|MSN|BSN|CSFA|CRNA)\b/.test(suffix)); const sentenceBreak = !protectedPeriod && (character === '.' || character === ';') && (index + 1 === source.length || /\s/.test(source[index + 1])); const commaBreak = splitCommas && character === ',' && !(/\d/.test(source[index - 1] || '') && /\d/.test(source[index + 1] || '')) && (index + 1 === source.length || /\s/.test(source[index + 1])); if (!sentenceBreak && !commaBreak) continue; push(index); start = index + 1; }
  push(source.length); return output;
};
const unwrapRecords = source => { if (!source) return []; const queue = Array.isArray(source) ? [...source] : [source], records = []; while (queue.length) { const value = queue.shift(); if (!value) continue; if (Array.isArray(value)) { queue.unshift(...value); continue; } if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; } if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; } if (value.data !== undefined && !Object.keys(LABELS).some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; } if (value.records !== undefined) { queue.unshift(value.records); continue; } if (typeof value === 'object') records.push(value); } return records.filter(record => Object.keys(LABELS).some(field => hasValue(record[field]))); };
const rowsFor = (record, field) => { const value = record[field]; if (!hasValue(value)) return []; if (DATE_FIELDS.has(field)) return isEpochDate(value) ? [] : [{ subtitle: '', value: formatDate(value) }]; if (ARRAY_FIELDS.has(field)) return value.filter(hasValue).map(item => ({ subtitle: '', value: String(item) })); if (NARRATIVE_FIELDS.has(field)) return splitClauses(value, COMMA_SPLIT_FIELDS.includes(field)).map(text => { const parsed = parseLabel(text); return { subtitle: parsed.subtitle, value: parsed.value }; }); return [{ subtitle: '', value: String(value) }]; };
const renderSection = (record, section, key) => { const fields = section.fields.filter(field => rowsFor(record, field).length); if (!fields.length) return null; const units = fields.flatMap(field => { const rows = rowsFor(record, field), showLabel = LABELS[field] !== section.title; return rows.map((row, index) => { const prior = index > 0 ? rows[index - 1].subtitle : null; return <View style={styles.fieldGroup} key={`${field}-${index}`} wrap={false}>{showLabel && index === 0 && <Text style={styles.fieldLabel}>{LABELS[field]}</Text>}{row.subtitle && row.subtitle !== prior && <Text style={styles.subtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}</Text></View>; }); }); const [first, ...rest] = units; return <View style={styles.section} key={key}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text>{first}</View>{rest}</View>; };

const BasalRateAdjustmentsDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Basal Rate Adjustments</Text><Text style={styles.noData}>No basal rate adjustment data available</Text></Page></Document>;
  return <Document><Page size="A4" style={styles.page} wrap><Text style={styles.documentTitle}>Basal Rate Adjustments</Text>{records.map((record, index) => <React.Fragment key={record._id?.$oid || String(record._id || index)}><View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Basal Rate Adjustments {index + 1}</Text></View>{SECTIONS.map((section, sectionIndex) => renderSection(record, section, sectionIndex))}</React.Fragment>)}</Page></Document>;
};
export default BasalRateAdjustmentsDocumentPDFTemplate;
