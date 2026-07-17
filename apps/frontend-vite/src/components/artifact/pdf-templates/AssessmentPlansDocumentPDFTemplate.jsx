import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'assessment_plans';
const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'Reviewed'];
const COMMA_SPLIT_FIELDS = ['assessment'];
const DISPLAY_FIELDS = ['date', 'provider', 'facility', 'status', 'chiefComplaint', 'assessment', 'diagnoses', 'plan', 'medications', 'procedures', 'referrals', 'testing', 'patientEducation', 'followUp', 'notes'];

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.32, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 6, marginBottom: 14 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 2, marginBottom: 6 },
  fieldRow: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '0.5pt solid #999999', paddingBottom: 1, marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.32 },
  listItem: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 10 },
  groupedListItem: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 20 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#555555' },
});

const hasValue = value => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasValue);
  return true;
};
const safeString = value => String(value ?? '')
  .replace(/μm|µm/g, 'um')
  .replace(/°/g, ' deg')
  .replace(/±/g, '+/-')
  .replace(/≥/g, '>=')
  .replace(/≤/g, '<=')
  .replace(/→/g, '->');
const canonicalStatus = value => {
  const raw = String(value ?? '').trim();
  return STATUS_OPTIONS.find(option => option.toLowerCase() === raw.toLowerCase()) || raw;
};
const formatDate = value => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return safeString(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&(),.'"-]{1,60}?):\s+([\s\S]+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true } : { label: '', value: String(text || '').trim(), labeled: false };
};
const splitNarrative = (field, text) => {
  const source = String(text || '');
  if (!source.trim()) return [];
  const clauses = [];
  let current = '';
  let depth = 0;
  const push = () => { const value = current.trim(); if (value) clauses.push(value); current = ''; };
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    const sentenceBreak = depth === 0 && (char === '.' || char === ';') && (i + 1 === source.length || /\s/.test(source[i + 1]));
    let commaBreak = false;
    if (depth === 0 && char === ',' && COMMA_SPLIT_FIELDS.includes(field)) {
      const before = current.trim();
      const after = source.slice(i + 1);
      const next = after.trimStart();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(next)) || /^(?:and|or|then)\b/i.test(next) || after.length === next.length;
      commaBreak = !protectedComma;
    }
    if (sentenceBreak || commaBreak) { push(); continue; }
    current += char;
  }
  push();
  return clauses;
};
const unwrapRecords = source => {
  if (!source) return [];
  const queue = Array.isArray(source) ? [...source] : [source];
  const records = [];
  while (queue.length) {
    const value = queue.shift();
    if (!value) continue;
    if (Array.isArray(value)) { queue.unshift(...value); continue; }
    if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; }
    if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; }
    if (value.data !== undefined && !DISPLAY_FIELDS.some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; }
    if (value.records !== undefined) { queue.unshift(value.records); continue; }
    if (typeof value === 'object') records.push(value);
  }
  return records.filter(record => DISPLAY_FIELDS.some(field => hasValue(record[field])));
};

const fieldRow = (label, value, key) => (
  <View style={styles.fieldRow} key={key || label}>
    <Text style={styles.fieldLabel}>{safeString(label)}</Text>
    <Text style={styles.fieldValue}>{safeString(value)}</Text>
  </View>
);
const arrayRows = items => items.filter(hasValue).map((item, index) => <Text style={styles.listItem} key={index}>{index + 1}. {safeString(item)}</Text>);
const narrativeRows = (field, value) => {
  const groups = [];
  let current = null;
  splitNarrative(field, value).forEach(clause => {
    const parsed = parseLabel(clause);
    if (parsed.labeled) {
      current = { subtitle: parsed.label, items: [parsed.value] };
      groups.push(current);
    } else if (current?.subtitle) current.items.push(parsed.value);
    else {
      if (!current || current.subtitle) { current = { subtitle: null, items: [] }; groups.push(current); }
      current.items.push(parsed.value);
    }
  });
  return groups.flatMap((group, groupIndex) => {
    const rows = [];
    if (group.subtitle) rows.push(<Text style={styles.fieldLabel} key={`label-${groupIndex}`}>{safeString(group.subtitle)}</Text>);
    group.items.forEach((item, itemIndex) => rows.push(<Text style={group.subtitle ? styles.groupedListItem : styles.listItem} key={`item-${groupIndex}-${itemIndex}`}>{itemIndex + 1}. {safeString(item)}</Text>));
    return rows;
  });
};
const renderSection = (title, rows, key, forceBreak = false) => {
  const visible = rows.filter(Boolean);
  if (!visible.length) return null;
  const [first, ...rest] = visible;
  return <View style={styles.section} key={key} break={forceBreak}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{first}</View>{rest}</View>;
};

const AssessmentPlansDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.noData}>No assessment plans available</Text></Page></Document>;
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Assessment Plans</Text>
        {records.map((record, index) => {
          const general = [];
          if (hasValue(record.date)) general.push(fieldRow('Date', formatDate(record.date), 'date'));
          if (hasValue(record.provider)) general.push(fieldRow('Provider', record.provider, 'provider'));
          if (hasValue(record.facility)) general.push(fieldRow('Facility', record.facility, 'facility'));
          if (hasValue(record.status)) general.push(fieldRow('Status', canonicalStatus(record.status), 'status'));
          return <React.Fragment key={record._id?.$oid || String(record._id || index)}>
            <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Assessment Plan {index + 1}</Text></View>
            {renderSection('General Information', general, 'general')}
            {hasValue(record.chiefComplaint) && renderSection('Chief Complaint', narrativeRows('chiefComplaint', record.chiefComplaint), 'chief')}
            {hasValue(record.assessment) && renderSection('Assessment', narrativeRows('assessment', record.assessment), 'assessment')}
            {hasValue(record.diagnoses) && renderSection('Diagnoses', arrayRows(record.diagnoses), 'diagnoses')}
            {hasValue(record.plan) && renderSection('Plan', narrativeRows('plan', record.plan), 'plan')}
            {hasValue(record.medications) && renderSection('Medications', arrayRows(record.medications), 'medications')}
            {hasValue(record.procedures) && renderSection('Procedures', arrayRows(record.procedures), 'procedures')}
            {hasValue(record.referrals) && renderSection('Referrals', arrayRows(record.referrals), 'referrals')}
            {hasValue(record.testing) && renderSection('Testing', arrayRows(record.testing), 'testing')}
            {hasValue(record.patientEducation) && renderSection('Patient Education', narrativeRows('patientEducation', record.patientEducation), 'education')}
            {hasValue(record.followUp) && renderSection('Follow-Up', narrativeRows('followUp', record.followUp), 'followup')}
            {hasValue(record.notes) && renderSection('Notes', narrativeRows('notes', record.notes), 'notes')}
          </React.Fragment>;
        })}
      </Page>
    </Document>
  );
};

export default AssessmentPlansDocumentPDFTemplate;
