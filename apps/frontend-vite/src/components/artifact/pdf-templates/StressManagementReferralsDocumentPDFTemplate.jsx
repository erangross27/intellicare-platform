/**
 * StressManagementReferralsDocumentPDFTemplate.jsx
 * July 2026 — canonical LETTER PDF
 * Collection: stress_management_referrals
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 52, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: .5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 5, marginBottom: 2 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_CONFIGS = [
  { title: 'Referral Information', fields: ['date', 'status', 'urgency', 'specialty', 'referringProvider'] },
  { title: 'Reason for Referral', fields: ['reason'] },
  { title: 'Notes', fields: ['notes'] },
];
const FIELD_LABELS = { date: 'Date', status: 'Status', urgency: 'Urgency', specialty: 'Specialty', referringProvider: 'Referring Provider', reason: 'Reason for Referral', notes: 'Notes' };
const COMMA_FIELDS = ['reason'];

const hasVal = value => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');
const formatDate = value => { try { const date = new Date(value?.$date || value); return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value || ''); } };
const splitBySentence = text => String(text || '').split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).flatMap(item => item.split(/(?<=\d)\.\s+(?=[A-Z])/)).map(item => item.replace(/[.;]+$/, '').trim()).filter(Boolean);
const splitByComma = text => {
  const result = []; let current = ''; let depth = 0;
  for (const ch of String(text || '')) {
    if (ch === '(') { depth += 1; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [String(text || '')];
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&()#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: String(text || '').trim() };
};
const rowsForField = (field, value) => {
  if (field === 'date') return [formatDate(value)];
  const sentences = splitBySentence(value);
  return COMMA_FIELDS.includes(field) ? sentences.flatMap(splitByComma) : sentences;
};

const renderField = (field, value, sectionTitle) => {
  const rows = rowsForField(field, value);
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.toLowerCase() !== String(sectionTitle || '').toLowerCase();
  const chunks = [];
  for (let index = 0; index < rows.length; index += 5) chunks.push(rows.slice(index, index + 5));
  return <>{chunks.map((chunk, chunkIndex) => {
    const offset = chunkIndex * 5;
    return <View key={chunkIndex} style={styles.fieldBox} wrap={false}>
      {chunkIndex === 0 && sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      {chunkIndex === 0 && showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {chunk.map((raw, rowIndex) => { const parsed = parseLabel(raw); return <View key={rowIndex}>{parsed.isLabeled && <Text style={styles.nestedSubtitle}>{parsed.label}</Text>}<Text style={rows.length > 1 ? styles.listItem : styles.fieldValue}>{offset + rowIndex + 1}. {parsed.isLabeled ? parsed.value : raw}</Text></View>; })}
    </View>;
  })}</>;
};

const StressManagementReferralsDocumentPDFTemplate = ({ document: docProp, data }) => {
  const records = React.useMemo(() => {
    const raw = docProp || data; if (!raw) return [];
    let items = Array.isArray(raw) ? raw : [raw];
    items = items.flatMap(item => {
      if (item?.stress_management_referrals) return Array.isArray(item.stress_management_referrals) ? item.stress_management_referrals : [item.stress_management_referrals];
      if (item?.documentData) { const nested = item.documentData; if (Array.isArray(nested)) return nested; if (nested?.stress_management_referrals) return Array.isArray(nested.stress_management_referrals) ? nested.stress_management_referrals : [nested.stress_management_referrals]; return [nested]; }
      if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
      if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
      return [item];
    });
    return items.filter(item => item && typeof item === 'object');
  }, [docProp, data]);

  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Stress Management Referrals</Text></View><Text style={styles.noDataText}>No data available</Text></Page></Document>;

  return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Stress Management Referrals</Text></View>{records.map((record, recordIndex) => <View key={recordIndex} style={styles.recordContainer}>{recordIndex > 0 && <View style={styles.separator} />}<View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>{`Stress Management Referral ${recordIndex + 1}`}</Text></View>{SECTION_CONFIGS.map((section, sectionIndex) => { const fields = section.fields.filter(field => hasVal(record[field])); if (!fields.length) return null; return <View key={sectionIndex} style={styles.section}>{fields.map((field, fieldIndex) => <React.Fragment key={field}>{renderField(field, record[field], fieldIndex === 0 ? section.title : null)}</React.Fragment>)}</View>; })}</View>)}</Page></Document>;
};

export default StressManagementReferralsDocumentPDFTemplate;
