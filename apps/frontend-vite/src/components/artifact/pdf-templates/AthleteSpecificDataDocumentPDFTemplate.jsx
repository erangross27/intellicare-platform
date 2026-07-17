import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'athlete_specific_data';
const COMMA_SPLIT_FIELDS = ['assessment'];
const DISPLAY_FIELDS = ['date', 'type', 'provider', 'facility', 'status', 'sport', 'position', 'professionalLevel', 'teamSupport', 'previousInjuries', 'psychologicalSupport', 'antiDopingNotification', 'findings', 'assessment', 'plan', 'recommendations', 'results', 'notes'];

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
  .replace(/μm|µm/g, 'um').replace(/μL|µL/g, 'uL').replace(/°/g, ' deg')
  .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->');
const humanize = value => {
  const text = String(value ?? '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return text ? text[0].toUpperCase() + text.slice(1) : '';
};
const displayScalar = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeString(value);
const formatDate = value => {
  if (!value) return '';
  const raw = value.$date || value;
  if (/^\d{4}$/.test(String(raw))) return String(raw);
  try {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? safeString(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(raw); }
};
const toInputDate = value => {
  if (!value) return '';
  const raw = value.$date || value;
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(raw))) return '';
  try { const date = new Date(raw); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); } catch { return ''; }
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&(),.'"<>-]{1,80}?):\s+([\s\S]+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true }
    : { label: '', value: String(text || '').trim(), labeled: false };
};
const splitNarrative = (field, text) => {
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
    const sentenceBreak = depth === 0 && (char === '.' || char === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]));
    let commaBreak = false;
    if (depth === 0 && char === ',' && COMMA_SPLIT_FIELDS.includes(field)) {
      const before = current.trim();
      const after = source.slice(index + 1);
      const next = after.trimStart();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(next)) || /^(?:and|or)\b/i.test(next) || after.length === next.length;
      commaBreak = !protectedComma;
    }
    if (sentenceBreak || commaBreak) { push(); continue; }
    current += char;
  }
  push();
  return output;
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

const fieldRow = (label, value, key) => <View style={styles.fieldRow} key={key || label} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text><Text style={styles.fieldValue}>{displayScalar(value)}</Text></View>;
const valueRow = (value, key, grouped = false) => <Text style={grouped ? styles.groupedListItem : styles.listItem} key={key}>{safeString(value)}</Text>;
const narrativeRows = (field, value, fallbackLabel) => {
  const groups = [];
  let current = null;
  splitNarrative(field, value).forEach(clause => {
    const parsed = parseLabel(clause);
    if (parsed.labeled) { current = { subtitle: parsed.label, items: [parsed.value] }; groups.push(current); }
    else if (current?.subtitle) current.items.push(parsed.value);
    else { if (!current || current.subtitle) { current = { subtitle: null, items: [] }; groups.push(current); } current.items.push(parsed.value); }
  });
  return groups.map((group, groupIndex) => <View style={styles.fieldRow} key={`${field}-${groupIndex}`} wrap={false}>{fallbackLabel && groupIndex === 0 && group.subtitle && <Text style={styles.fieldLabel}>{fallbackLabel}</Text>}{(group.subtitle || fallbackLabel) && <Text style={styles.fieldLabel}>{safeString(group.subtitle || fallbackLabel)}</Text>}{group.items.map((item, itemIndex) => valueRow(`${itemIndex + 1}. ${item}`, itemIndex, !!(group.subtitle || fallbackLabel)))}</View>);
};
const renderSection = (title, rows, key) => {
  const visible = rows.flat().filter(Boolean);
  if (!visible.length) return null;
  const [first, ...rest] = visible;
  return <View style={styles.section} key={key}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{first}</View>{rest}</View>;
};
const groupByDate = values => {
  const groups = new Map();
  values.forEach((value, index) => {
    if (!hasValue(value)) return;
    const key = toInputDate(value.date) || String(value.date || 'no-date');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ value, index });
  });
  return [...groups.entries()];
};
const injuryRows = injuries => groupByDate(Array.isArray(injuries) ? injuries : []).map(([dateKey, entries], groupIndex) => {
  const rows = [];
  if (dateKey !== 'no-date') rows.push(fieldRow('Date', formatDate(entries[0].value.date), `date-${groupIndex}`));
  entries.forEach(({ value, index }) => {
    if (hasValue(value.injury)) rows.push(fieldRow(`Injury ${index + 1}`, value.injury, `injury-${index}`));
    if (hasValue(value.recovery)) rows.push(fieldRow('Recovery', value.recovery, `recovery-${index}`));
  });
  return <View key={`injury-group-${groupIndex}`} wrap={false}>{rows}</View>;
});
const recommendationRows = recommendations => groupByDate(Array.isArray(recommendations) ? recommendations : []).map(([dateKey, entries], groupIndex) => {
  const rows = [];
  if (dateKey !== 'no-date') rows.push(fieldRow('Date', formatDate(entries[0].value.date), `rec-date-${groupIndex}`));
  entries.forEach(({ value, index }) => rows.push(...narrativeRows('recommendations', value.recommendation, null).map((row, rowIndex) => React.cloneElement(row, { key: `rec-${index}-${rowIndex}` }))));
  return <View key={`recommendation-group-${groupIndex}`} wrap={false}>{rows}</View>;
});
const objectRows = (value, path = '') => {
  if (!hasValue(value)) return [];
  if (value === null || typeof value !== 'object') return [fieldRow(humanize(path.split('.').pop()), toInputDate(value) ? formatDate(value) : value, path)];
  return Object.entries(value).filter(([, child]) => hasValue(child)).flatMap(([key, child]) => objectRows(child, path ? `${path}.${key}` : key));
};

const AthleteSpecificDataDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Athlete Specific Data</Text><Text style={styles.noData}>No athlete specific data available</Text></Page></Document>;
  return <Document><Page size="A4" style={styles.page} wrap><Text style={styles.documentTitle}>Athlete Specific Data</Text>{records.map((record, index) => {
    const recordRows = [];
    if (hasValue(record.date)) recordRows.push(fieldRow('Date', formatDate(record.date), 'date'));
    if (hasValue(record.type)) recordRows.push(fieldRow('Type', record.type, 'type'));
    if (hasValue(record.provider)) recordRows.push(fieldRow('Provider', record.provider, 'provider'));
    if (hasValue(record.facility)) recordRows.push(fieldRow('Facility', record.facility, 'facility'));
    if (hasValue(record.status)) recordRows.push(fieldRow('Status', record.status, 'status'));
    const sportRows = [];
    if (hasValue(record.sport)) sportRows.push(fieldRow('Sport', record.sport, 'sport'));
    if (hasValue(record.position)) sportRows.push(fieldRow('Position', record.position, 'position'));
    if (hasValue(record.professionalLevel)) sportRows.push(fieldRow('Professional Level', record.professionalLevel, 'professionalLevel'));
    if (hasValue(record.teamSupport)) sportRows.push(fieldRow('Team Support', record.teamSupport, 'teamSupport'));
    const supportRows = [];
    if (hasValue(record.psychologicalSupport)) supportRows.push(fieldRow('Psychological Support', record.psychologicalSupport, 'psychologicalSupport'));
    if (hasValue(record.antiDopingNotification)) supportRows.push(fieldRow('Anti-Doping Notification', record.antiDopingNotification, 'antiDopingNotification'));
    return <React.Fragment key={record._id?.$oid || String(record._id || index)}><View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Athlete Specific Data {index + 1}</Text></View>{renderSection('Record Information', recordRows, 'recordInfo')}{renderSection('Sport Profile', sportRows, 'sportProfile')}{renderSection('Previous Injuries', injuryRows(record.previousInjuries), 'previousInjuries')}{renderSection('Support & Compliance', supportRows, 'supportCompliance')}{hasValue(record.findings) && renderSection('Findings', narrativeRows('findings', record.findings, null), 'findings')}{hasValue(record.assessment) && renderSection('Assessment', narrativeRows('assessment', record.assessment, null), 'assessment')}{hasValue(record.plan) && renderSection('Plan', narrativeRows('plan', record.plan, null), 'plan')}{renderSection('Recommendations', recommendationRows(record.recommendations), 'recommendations')}{renderSection('Results', objectRows(record.results), 'results')}{hasValue(record.notes) && renderSection('Notes', narrativeRows('notes', record.notes, null), 'notes')}</React.Fragment>;
  })}</Page></Document>;
};

export default AthleteSpecificDataDocumentPDFTemplate;
