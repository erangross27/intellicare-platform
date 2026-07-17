import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'autoantibody_profile';
const CORE_FIELDS = [['antiDsDna', 'Anti-dsDNA'], ['antiSmith', 'Anti-Smith'], ['antiSsaRo', 'Anti-SSA/Ro'], ['antiSsbLa', 'Anti-SSB/La'], ['antiRnp', 'Anti-RNP'], ['antiScl70', 'Anti-Scl-70'], ['antiCentromere', 'Anti-Centromere'], ['antiJo1', 'Anti-Jo-1'], ['antiCcp', 'Anti-CCP'], ['rheumatoidFactor', 'Rheumatoid Factor']];
const FIXED_OBJECTS = {
  ana: [['titer', 'Titer'], ['pattern', 'Pattern'], ['positive', 'Positive']],
  antiphospholipidAntibodies: [['anticardiolipin.IgG', 'Anticardiolipin IgG'], ['anticardiolipin.IgM', 'Anticardiolipin IgM'], ['beta2Glycoprotein.IgG', 'Beta-2 Glycoprotein IgG'], ['beta2Glycoprotein.IgM', 'Beta-2 Glycoprotein IgM'], ['lupusAnticoagulant', 'Lupus Anticoagulant']],
  anca: [['cAnca', 'c-ANCA'], ['pAnca', 'p-ANCA'], ['antiPr3', 'Anti-PR3'], ['antiMpo', 'Anti-MPO']],
};
const LABELS = { date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status', ana: 'ANA Panel', ...Object.fromEntries(CORE_FIELDS), antiphospholipidAntibodies: 'Antiphospholipid Antibodies', anca: 'ANCA Panel', results: 'Results', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', notes: 'Notes' };
const SECTIONS = [
  { title: 'Date', fields: ['date'] },
  { title: 'Record Information', fields: ['provider', 'facility', 'status'] },
  { title: 'ANA Panel', fields: ['ana'] },
  { title: 'Core Antibodies', fields: CORE_FIELDS.map(([field]) => field) },
  { title: 'Antiphospholipid Antibodies', fields: ['antiphospholipidAntibodies'] },
  { title: 'ANCA Panel', fields: ['anca'] },
  { title: 'Results', fields: ['results'] },
  { title: 'Findings', fields: ['findings'] },
  { title: 'Assessment', fields: ['assessment'] },
  { title: 'Plan', fields: ['plan'] },
  { title: 'Recommendations', fields: ['recommendations'] },
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
const getAtPath = (source, path) => path.split('.').reduce((value, part) => value?.[/^\d+$/.test(part) ? Number(part) : part], source);
const humanize = key => String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase());
const formatDate = value => {
  const raw = value?.$date || value;
  const match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(raw || '');
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};
const displayValue = (path, value) => path === 'ana.positive' ? (value ? 'Positive' : 'Negative') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&()'"-]{1,60}?):\s+([\s\S]+)$/);
  return match ? { subtitle: match[1].trim(), value: match[2].trim() } : { subtitle: '', value: String(text || '').trim() };
};
const splitClauses = (field, text, commas = field === 'assessment') => {
  const source = String(text || '');
  const output = [];
  let current = '';
  let depth = 0;
  const push = () => { if (current.trim()) output.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const sentenceBreak = depth === 0 && (character === '.' || character === ';') && (index + 1 === source.length || /\s/.test(source[index + 1]));
    const commaBreak = depth === 0 && commas && character === ',';
    if (sentenceBreak || commaBreak) push(); else current += character;
  }
  push();
  return output;
};
const flattenLeaves = (value, prefix = '', labelPrefix = '') => {
  if (Array.isArray(value)) return value.flatMap((child, index) => {
    const path = prefix ? `${prefix}.${index}` : String(index);
    const label = `${labelPrefix || 'Item'} ${index + 1}`;
    return child && typeof child === 'object' && !child.$date ? flattenLeaves(child, path, label) : hasValue(child) ? [{ path, label, value: child }] : [];
  });
  return Object.entries(value || {}).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const label = labelPrefix ? `${labelPrefix} — ${humanize(key)}` : humanize(key);
    return child && typeof child === 'object' && !child.$date ? flattenLeaves(child, path, label) : hasValue(child) ? [{ path, label, value: child }] : [];
  });
};
const groupRecommendations = value => {
  const groups = [];
  (Array.isArray(value) ? value : []).forEach(item => {
    if (!hasValue(item)) return;
    const key = item?.date ? formatDate(item.date) : 'no-date';
    let group = groups.find(candidate => candidate.key === key);
    if (!group) { group = { key, date: item?.date, items: [] }; groups.push(group); }
    group.items.push(item);
  });
  return groups;
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
    if (value.data !== undefined && !Object.keys(LABELS).some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; }
    if (value.records !== undefined) { queue.unshift(value.records); continue; }
    if (typeof value === 'object') records.push(value);
  }
  return records.filter(record => Object.keys(LABELS).some(field => hasValue(record[field])));
};
const rowsFor = (record, field) => {
  const value = record[field];
  if (!hasValue(value)) return [];
  if (field === 'date') return [{ value: formatDate(value) }];
  if (FIXED_OBJECTS[field]) return FIXED_OBJECTS[field].flatMap(([path, label]) => {
    const child = getAtPath(value, path);
    return hasValue(child) ? [{ subtitle: label, value: displayValue(`${field}.${path}`, child) }] : [];
  });
  if (field === 'results') return flattenLeaves(value).map(leaf => ({ subtitle: leaf.label, value: /date/i.test(leaf.path.split('.').pop()) ? formatDate(leaf.value) : displayValue(`results.${leaf.path}`, leaf.value) }));
  if (field === 'recommendations') return groupRecommendations(value).flatMap(group => [
    ...(group.date ? [{ subtitle: 'Date', value: formatDate(group.date) }] : []),
    ...group.items.flatMap(item => splitClauses('recommendations', item?.recommendation ?? item?.text ?? item?.value ?? '', true).map(text => ({ value: text }))),
  ]);
  if (['findings', 'assessment', 'plan'].includes(field)) return splitClauses(field, value).map(text => parseLabel(text));
  return [{ value: displayValue(field, value) }];
};
const renderSection = (record, section, key) => {
  const fields = section.fields.filter(field => rowsFor(record, field).length);
  if (!fields.length) return null;
  const units = fields.flatMap(field => {
    const rows = rowsFor(record, field);
    const showLabel = LABELS[field] !== section.title;
    return rows.map((row, index) => <View style={styles.fieldGroup} key={`${field}-${index}`} wrap={false}>{showLabel && index === 0 && <Text style={styles.fieldLabel}>{LABELS[field]}</Text>}{row.subtitle && <Text style={styles.subtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}</Text></View>);
  });
  const [first, ...rest] = units;
  return <View style={styles.section} key={key}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text>{first}</View>{rest}</View>;
};

const AutoantibodyProfileDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Autoantibody Profile</Text><Text style={styles.noData}>No autoantibody profile data available</Text></Page></Document>;
  return <Document><Page size="A4" style={styles.page} wrap><Text style={styles.documentTitle}>Autoantibody Profile</Text>{records.map((record, index) => <React.Fragment key={record._id?.$oid || String(record._id || index)}><View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Autoantibody Profile {index + 1}</Text></View>{SECTIONS.map((section, sectionIndex) => renderSection(record, section, sectionIndex))}</React.Fragment>)}</Page></Document>;
};

export default AutoantibodyProfileDocumentPDFTemplate;
