import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.45,
    color: '#000000',
    backgroundColor: '#ffffff'
  },
  pageSurface: {
    width: 612,
    height: 792,
    padding: 40,
    paddingBottom: 54,
    backgroundColor: '#ffffff',
    position: 'relative'
  },
  documentHeader: { marginBottom: 22 },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid'
  },
  recordContainer: { paddingBottom: 20 },
  recordHeader: { marginBottom: 14 },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid'
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid'
  },
  fieldBlock: { marginBottom: 9 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 2,
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid'
  },
  listItem: { fontSize: 14, lineHeight: 1.45, marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#4b5563', marginTop: 24 }
});

const FIELD_CONFIGS = [
  { key: 'date', label: 'Date', kind: 'date' },
  { key: 'specialty', label: 'Specialty' },
  { key: 'reason', label: 'Reason', kind: 'sentence' },
  { key: 'urgency', label: 'Urgency' },
  { key: 'status', label: 'Status' },
  { key: 'provider', label: 'Provider' },
  { key: 'referringProvider', label: 'Referring Provider' },
  { key: 'notes', label: 'Notes', kind: 'sentence' }
];

const safeString = (value) => String(value ?? '')
  .replace(/\u00d7/g, 'x')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2013\u2014]/g, '-');

const hasValue = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' ? value.trim() !== '' : true;
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return safeString(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};

// Mirrors the JSX splitter: periods and semicolons delimit rows, while titles and parentheses stay intact.
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenthesisDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(') parenthesisDepth += 1;
    else if (character === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    if ((character === '.' || character === ';') && parenthesisDepth === 0 && /\s/.test(text[index + 1] || '')) {
      if (character === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) {
        current += character;
        continue;
      }
      if (current.trim()) result.push(current.trim());
      current = '';
      while (/\s/.test(text[index + 1] || '')) index += 1;
    } else {
      current += character;
    }
  }
  const tail = current.replace(/[.;]+$/, '').trim();
  if (tail) result.push(tail);
  return result;
};

const fieldRows = (record, config) => {
  const value = record[config.key];
  if (!hasValue(value)) return [];
  if (config.kind === 'date') return [formatDate(value)];
  if (config.kind === 'sentence') return splitBySentence(safeString(value));
  if (Array.isArray(value)) return value.map(safeString).filter(Boolean);
  return [safeString(value)];
};

const renderField = (record, config) => {
  const rows = fieldRows(record, config);
  if (!rows.length) return null;
  return (
    <View style={styles.fieldBlock} wrap={rows.length > 8 ? true : false}>
      <Text style={styles.fieldLabel}>{config.label}</Text>
      {rows.map((row, index) => (
        <Text key={index} style={styles.listItem}>{index + 1}. {safeString(row)}</Text>
      ))}
    </View>
  );
};

const renderSection = (record, recordTitle) => {
  const fields = FIELD_CONFIGS.map(config => renderField(record, config)).filter(Boolean);
  if (!fields.length) return null;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <View style={styles.recordHeader}>
          <Text style={styles.recordTitle}>{recordTitle}</Text>
        </View>
        <Text style={styles.sectionTitle}>Referral Details</Text>
        {React.cloneElement(fields[0], { key: 'first' })}
      </View>
      {fields.slice(1).map((field, index) => React.cloneElement(field, { key: `field-${index + 1}` }))}
    </View>
  );
};

const unwrapRecords = (data) => {
  if (!data) return [];
  const input = Array.isArray(data) ? data : [data];
  return input.flatMap(record => {
    if (record?.referrals) return Array.isArray(record.referrals) ? record.referrals : [record.referrals];
    if (record?.records) return Array.isArray(record.records) ? record.records : [record.records];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.referrals) return Array.isArray(nested.referrals) ? nested.referrals : [nested.referrals];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const ReferralsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  return (
    <Document>
      {!records.length ? (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.pageSurface}>
            <View style={styles.documentHeader} wrap={false}>
              <Text style={styles.documentTitle}>Medical Referrals</Text>
            </View>
            <Text style={styles.noDataText}>No referrals available.</Text>
          </View>
        </Page>
      ) : records.map((record, index) => {
        const number = (record._origIdx ?? index) + 1;
        return (
          <Page key={record._id?.$oid || record._id || index} size="LETTER" style={styles.page}>
            <View style={styles.pageSurface}>
              {index === 0 ? (
                <View style={styles.documentHeader} wrap={false}>
                  <Text style={styles.documentTitle}>Medical Referrals</Text>
                </View>
              ) : null}
              <View style={styles.recordContainer}>
                {renderSection(record, `Medical Referrals ${number}`)}
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

export default ReferralsDocumentPDFTemplate;
