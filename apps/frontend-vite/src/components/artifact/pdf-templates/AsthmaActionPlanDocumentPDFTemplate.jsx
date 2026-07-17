import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'asthma_action_plan';
const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'Reviewed'];
const DISPLAY_ROOTS = ['date', 'type', 'provider', 'facility', 'status', 'findings', 'greenZone', 'yellowZone', 'redZone', 'results', 'assessment', 'plan', 'recommendations', 'notes'];

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
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return true;
};
const safeString = value => String(value ?? '')
  .replace(/μm|µm/g, 'um')
  .replace(/°/g, ' deg')
  .replace(/±/g, '+/-')
  .replace(/≥/g, '>=')
  .replace(/≤/g, '<=')
  .replace(/→/g, '->');
const displayScalar = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeString(value);
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
const humanizeKey = key => String(key || '')
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, first => first.toUpperCase());
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&(),.'"-]{1,60}?):\s+([\s\S]+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true }
    : { label: '', value: String(text || '').trim(), labeled: false };
};
const splitNarrative = text => {
  const source = String(text || '');
  if (!source.trim()) return [];
  const output = [];
  let current = '';
  let depth = 0;
  const push = () => { const value = current.trim(); if (value) output.push(value); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (depth === 0 && (char === '.' || char === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]))) { push(); continue; }
    current += char;
  }
  push();
  return output;
};
const normalizeDateKey = value => {
  if (!hasValue(value)) return 'no-date';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
  } catch { return String(value); }
};
const unwrapRecords = source => {
  if (!source) return [];
  const queue = Array.isArray(source) ? [...source] : [source];
  const output = [];
  while (queue.length) {
    const value = queue.shift();
    if (!value) continue;
    if (Array.isArray(value)) { queue.unshift(...value); continue; }
    if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; }
    if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; }
    if (value.data !== undefined && !DISPLAY_ROOTS.some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; }
    if (value.records !== undefined) { queue.unshift(value.records); continue; }
    if (typeof value === 'object') output.push(value);
  }
  return output.filter(record => DISPLAY_ROOTS.some(field => hasValue(record[field])));
};

const fieldRow = (label, value, key) => (
  <View style={styles.fieldRow} key={key || label} wrap={false}>
    <Text style={styles.fieldLabel}>{safeString(label)}</Text>
    <Text style={styles.fieldValue}>{displayScalar(value)}</Text>
  </View>
);
const arrayField = (label, values, key) => {
  const items = (Array.isArray(values) ? values : []).filter(hasValue);
  if (!items.length) return null;
  return <View style={styles.fieldRow} key={key || label} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text>{items.map((item, index) => <Text style={styles.listItem} key={index}>{index + 1}. {displayScalar(item)}</Text>)}</View>;
};
const narrativeRows = value => {
  const groups = [];
  let current = null;
  splitNarrative(value).forEach(clause => {
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
  return groups.map((group, groupIndex) => <View style={styles.fieldRow} key={groupIndex} wrap={false}>{group.subtitle && <Text style={styles.fieldLabel}>{safeString(group.subtitle)}</Text>}{group.items.map((item, itemIndex) => <Text style={group.subtitle ? styles.groupedListItem : styles.listItem} key={itemIndex}>{itemIndex + 1}. {safeString(item)}</Text>)}</View>);
};
const renderSection = (title, rows, key) => {
  const visible = rows.filter(Boolean);
  if (!visible.length) return null;
  const [first, ...rest] = visible;
  return <View style={styles.section} key={key}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{first}</View>{rest}</View>;
};
const resultsRows = (value, path = 'results', label = '') => {
  if (!hasValue(value)) return [];
  if (Array.isArray(value)) {
    const items = value.filter(hasValue);
    if (items.every(item => typeof item !== 'object' || item === null)) return [arrayField(label || humanizeKey(path.split('.').pop()), items, path)];
    return items.flatMap((item, index) => resultsRows(item, `${path}.${index}`, `${label || 'Item'} ${index + 1}`));
  }
  if (typeof value === 'object' && value !== null) return Object.entries(value).flatMap(([key, child]) => resultsRows(child, `${path}.${key}`, humanizeKey(key)));
  return [fieldRow(label || humanizeKey(path.split('.').pop()), displayScalar(value), path)];
};
const recommendationRows = recommendations => {
  const groups = new Map();
  recommendations.forEach(item => {
    const normalized = typeof item === 'string' ? { recommendation: item, date: '' } : item || {};
    const key = normalizeDateKey(normalized.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(normalized);
  });
  return [...groups.entries()].map(([key, items]) => <View style={styles.fieldRow} key={key} wrap={false}>{hasValue(items[0]?.date) && <><Text style={styles.fieldLabel}>Date</Text><Text style={styles.fieldValue}>{formatDate(items[0].date)}</Text></>}{items.filter(item => hasValue(item.recommendation)).map((item, index) => <Text style={styles.listItem} key={index}>{index + 1}. {safeString(item.recommendation)}</Text>)}</View>);
};
const zoneRows = (zone, fields) => fields.flatMap(([field, label]) => {
  const value = zone?.[field];
  if (!hasValue(value)) return [];
  return [Array.isArray(value) ? arrayField(label, value, field) : fieldRow(label, value, field)];
});

const AsthmaActionPlanDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Asthma Action Plans</Text><Text style={styles.noData}>No asthma action plans available</Text></Page></Document>;
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Asthma Action Plans</Text>
        {records.map((record, index) => {
          const planInfo = [];
          if (hasValue(record.date)) planInfo.push(fieldRow('Date', formatDate(record.date), 'date'));
          if (hasValue(record.type)) planInfo.push(fieldRow('Type', record.type, 'type'));
          if (hasValue(record.provider)) planInfo.push(fieldRow('Provider', record.provider, 'provider'));
          if (hasValue(record.facility)) planInfo.push(fieldRow('Facility', record.facility, 'facility'));
          if (hasValue(record.status)) planInfo.push(fieldRow('Status', canonicalStatus(record.status), 'status'));
          return <React.Fragment key={record._id?.$oid || String(record._id || index)}>
            <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Asthma Action Plan {index + 1}</Text></View>
            {renderSection('Plan Information', planInfo, 'planInfo')}
            {hasValue(record.findings) && renderSection('Findings', narrativeRows(record.findings), 'findings')}
            {hasValue(record.greenZone) && renderSection('Green Zone - Doing Well', zoneRows(record.greenZone, [['peakFlowRange', 'Peak Flow Range'], ['symptoms', 'Symptoms'], ['medications', 'Medications'], ['actions', 'Actions']]), 'greenZone')}
            {hasValue(record.yellowZone) && renderSection('Yellow Zone - Caution', zoneRows(record.yellowZone, [['peakFlowRange', 'Peak Flow Range'], ['symptoms', 'Symptoms'], ['medications', 'Medications'], ['actions', 'Actions'], ['contactInstructions', 'Contact Instructions']]), 'yellowZone')}
            {hasValue(record.redZone) && renderSection('Red Zone - Medical Alert', zoneRows(record.redZone, [['peakFlowRange', 'Peak Flow Range'], ['symptoms', 'Symptoms'], ['emergencyMedications', 'Emergency Medications'], ['emergencyContact', 'Emergency Contact'], ['when911', 'When to Call 911']]), 'redZone')}
            {hasValue(record.results) && renderSection('Results', resultsRows(record.results), 'results')}
            {hasValue(record.assessment) && renderSection('Assessment', narrativeRows(record.assessment), 'assessment')}
            {hasValue(record.plan) && renderSection('Plan', narrativeRows(record.plan), 'plan')}
            {Array.isArray(record.recommendations) && record.recommendations.some(hasValue) && renderSection('Recommendations', recommendationRows(record.recommendations), 'recommendations')}
            {hasValue(record.notes) && renderSection('Notes', narrativeRows(record.notes), 'notes')}
          </React.Fragment>;
        })}
      </Page>
    </Document>
  );
};

export default AsthmaActionPlanDocumentPDFTemplate;
