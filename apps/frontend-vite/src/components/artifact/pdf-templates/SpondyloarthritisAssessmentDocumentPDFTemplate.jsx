/**
 * Box-free LETTER PDF for spondyloarthritis_assessment.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 52, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  record: { paddingBottom: 14 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginTop: 12, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldUnit: { paddingBottom: 5 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 6, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_TITLES = {
  overview: 'Overview',
  'disease-activity': 'Disease Activity',
  'spinal-mobility': 'Spinal Mobility',
  manifestations: 'Peripheral Manifestations',
  clinical: 'Clinical Assessment',
  recommendations: 'Recommendations',
  results: 'Results',
};

const FIELD_LABELS = {
  date: 'Assessment Date',
  type: 'Assessment Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  basdaiScore: 'BASDAI Score',
  basfiScore: 'BASFI Score',
  asdas: 'ASDAS',
  hlab27: 'HLA-B27',
  sacroiliitis: 'Sacroiliitis',
  enthesitis: 'Enthesitis',
  dactylitis: 'Dactylitis',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const OBJECT_SECTIONS = {
  'spinal-mobility': 'spinalMobility',
  results: 'results',
};

const COMMA_FIELDS = [];

const safeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value)
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u00d7/g, 'x')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ');
};

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  if (typeof value === 'object') return Object.values(value).some(hasVal);
  return true;
};

const humanizeKey = (key) => safeString(key)
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, (char) => char.toUpperCase());

const unwrapData = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap(unwrapData);
  if (input.spondyloarthritis_assessment) return unwrapData(input.spondyloarthritis_assessment);
  if (input.documentData) return unwrapData(input.documentData);
  if (input.data) return unwrapData(input.data);
  if (input.records) return unwrapData(input.records);
  return [input];
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return safeString(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};

const normalizeDateKey = (value) => {
  if (!value) return 'no-date';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? safeString(value) : date.toISOString().slice(0, 10);
  } catch { return safeString(value) || 'no-date'; }
};

const isProtectedPeriod = (source, index) => {
  const before = source.slice(0, index);
  const token = (before.match(/([A-Za-z.]+)$/) || [])[1] || '';
  return /^(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i.test(token)
    || /^[A-Z]$/.test(token)
    || /\d$/.test(before);
};

const isProtectedComma = (source, index, currentText) => {
  const after = source.slice(index + 1);
  const trimmed = after.trimStart();
  const next = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
  const previous = (currentText.trim().match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
  return after.length === trimmed.length
    || (/\d$/.test(currentText.trim()) && /^\d{3}\b/.test(trimmed))
    || ['and', 'or', 'then'].includes(next)
    || ['and', 'or'].includes(previous);
};

const splitNarrativeSegments = (value, splitCommas = false) => {
  const source = safeString(value);
  if (!source) return [];
  const values = [];
  let start = 0;
  let depth = 0;
  const push = (end) => {
    const text = source.slice(start, end).trim();
    if (text) values.push(text);
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) continue;
    const nextIsSpace = /\s/.test(source[index + 1] || '');
    const currentText = source.slice(start, index);
    const splitSemicolon = char === ';' && nextIsSpace;
    const splitPeriod = char === '.' && nextIsSpace && !isProtectedPeriod(source, index);
    const splitComma = splitCommas && char === ',' && nextIsSpace && !isProtectedComma(source, index, currentText);
    if (!splitSemicolon && !splitPeriod && !splitComma) continue;
    push(index);
    start = index + 1;
  }
  push(source.length);
  return values.length ? values : [source];
};

const splitBySentence = (value) => safeString(value)
  .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.(?:\s+)|;\s+/)
  .map((part) => part.trim())
  .filter(Boolean);

const parseLabel = (value) => {
  const match = safeString(value).match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{0,60}?):\s+(.+)$/);
  return match
    ? { label: match[1].trim(), value: match[2].trim() }
    : { label: '', value: safeString(value) };
};

const partsForField = (field, value) => {
  splitBySentence(value);
  return splitNarrativeSegments(value, COMMA_FIELDS.includes(field) || /^recommendations\.\d+(?:\.recommendation)?$/.test(field)).map(parseLabel);
};

const sameAsTitle = (label, sid) => safeString(label).trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

const fieldUnits = (label, inputParts, keyBase, showLabel = true) => {
  let row = 0;
  return inputParts.map((input, index) => {
    const part = typeof input === 'object' && input && Object.hasOwn(input, 'value') ? input : { label: '', value: safeString(input) };
    if (part.label) row = 1;
    else row += 1;
    return (
      <View key={`${keyBase}-${index}`} style={styles.fieldUnit} wrap={false}>
        {index === 0 && showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {part.label && <Text style={styles.fieldLabel}>{safeString(part.label)}</Text>}
        <Text style={styles.listItem}>{row}. {safeString(part.value)}</Text>
      </View>
    );
  });
};

const renderSection = (title, units, key) => {
  if (!units.length) return null;
  const [first, ...rest] = units;
  return (
    <View key={key} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const sectionUnits = (record, fields) => fields.flatMap((field) => {
  const value = record[field];
  if (!hasVal(value)) return [];
  const values = field === 'date'
    ? [formatDate(value)]
    : Array.isArray(value)
      ? value.filter(hasVal).map(safeString)
      : partsForField(field, value);
  return fieldUnits(FIELD_LABELS[field] || humanizeKey(field), values, field);
});

const objectUnits = (record, sid) => {
  const root = OBJECT_SECTIONS[sid];
  const object = record[root];
  if (!object || typeof object !== 'object' || Array.isArray(object)) return [];
  return Object.entries(object).filter(([, value]) => hasVal(value)).flatMap(([key, value]) => {
    const field = `${root}.${key}`;
    const values = Array.isArray(value) ? value.filter(hasVal).map(safeString) : partsForField(field, value);
    return fieldUnits(humanizeKey(key), values, field);
  });
};

const recommendationUnits = (record) => {
  const groups = new Map();
  (Array.isArray(record.recommendations) ? record.recommendations : []).forEach((item, itemIndex) => {
    const recommendation = typeof item === 'string' ? { recommendation: item, date: '' } : item || {};
    if (!hasVal(recommendation.recommendation)) return;
    const key = normalizeDateKey(recommendation.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ recommendation, itemIndex });
  });
  return [...groups.entries()].flatMap(([key, items]) => {
    const values = [];
    items.forEach(({ recommendation, itemIndex }) => {
      const field = typeof record.recommendations[itemIndex] === 'string'
        ? `recommendations.${itemIndex}`
        : `recommendations.${itemIndex}.recommendation`;
      values.push(...partsForField(field, recommendation.recommendation));
    });
    const label = key === 'no-date' ? 'No Date' : formatDate(items[0].recommendation.date);
    return fieldUnits(label, values, `recommendations-${key}`);
  });
};

const goalUnits = (record) => fieldUnits('Goals', (Array.isArray(record.goals) ? record.goals : []).filter(hasVal).map(safeString), 'goals', false);

const SpondyloarthritisAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapData(data).filter((record) => record && typeof record === 'object');

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Spondyloarthritis Assessment</Text>
        {!records.length && <Text style={styles.noDataText}>No data available</Text>}
        {records.map((record, index) => (
          <View key={record._id?.$oid || record._id || index} style={styles.record} break={index > 0}>
            <Text style={styles.recordTitle}>Spondyloarthritis Assessment {index + 1}</Text>
            {renderSection(SECTION_TITLES.overview, sectionUnits(record, ['date', 'type', 'provider', 'facility', 'status']), `overview-${index}`)}
            {renderSection(SECTION_TITLES['disease-activity'], sectionUnits(record, ['basdaiScore', 'basfiScore', 'asdas', 'hlab27', 'sacroiliitis']), `disease-activity-${index}`)}
            {renderSection(SECTION_TITLES['spinal-mobility'], objectUnits(record, 'spinal-mobility'), `spinal-mobility-${index}`)}
            {renderSection(SECTION_TITLES.manifestations, sectionUnits(record, ['enthesitis', 'dactylitis']), `manifestations-${index}`)}
            {renderSection(SECTION_TITLES.clinical, sectionUnits(record, ['findings', 'assessment', 'plan', 'notes']), `clinical-${index}`)}
            {renderSection(SECTION_TITLES.recommendations, recommendationUnits(record), `recommendations-${index}`)}
            {renderSection(SECTION_TITLES.results, objectUnits(record, 'results'), `results-${index}`)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SpondyloarthritisAssessmentDocumentPDFTemplate;
