/** Transplant Assessment — canonical box-free PDF, collection transplant_assessment. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginTop: 9, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'transplant-details': 'Transplant Details',
  'hla-typing': 'HLA Typing',
  'clinical-findings': 'Findings',
  assessment: 'Assessment',
  'plan-section': 'Plan',
  'recommendations-section': 'Recommendations',
  'notes-status': 'Notes & Status',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  eligibility: 'Eligibility',
  transplantType: 'Transplant Type',
  timing: 'Timing',
  conditioning: 'Conditioning',
  stemCellSource: 'Stem Cell Source',
  donorSearch: 'Donor Search',
  comorbidityIndex: 'Comorbidity Index',
  hlaTyping: 'HLA Typing',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
  status: 'Status',
  results: 'Results',
};

const SECTION_FIELDS = {
  'provider-info': ['date', 'provider', 'facility'],
  'transplant-details': ['eligibility', 'transplantType', 'timing', 'conditioning', 'stemCellSource', 'donorSearch', 'comorbidityIndex'],
  'hla-typing': ['hlaTyping'],
  'clinical-findings': ['findings'],
  assessment: ['assessment'],
  'plan-section': ['plan'],
  'recommendations-section': ['recommendations'],
  'notes-status': ['notes', 'status', 'results'],
};

const DATE_FIELDS = new Set(['date']);
const ARRAY_FIELDS = new Set(['recommendations']);
const OBJECT_FIELDS = new Set(['hlaTyping', 'results']);
const PERIOD_SPLIT_FIELDS = new Set(['timing', 'findings', 'assessment', 'plan', 'notes', 'recommendations']);
const COMMA_ARRAY_FIELDS = new Set();

const safeString = value => String(value ?? '')
  .replace(/×/g, 'x')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...');

const hasVal = value => value !== null && value !== undefined && value !== ''
  && (typeof value !== 'string' || value.trim() !== '')
  && (!Array.isArray(value) || value.length > 0)
  && (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0);

const sameAsTitle = (label, sid) => label.trim().toLowerCase() === SECTION_TITLES[sid].trim().toLowerCase();

const formatDate = value => {
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime())
      ? safeString(value)
      : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(value);
  }
};

const formatLabel = key => safeString(key)
  .replace(/([A-Z])/g, ' $1')
  .replace(/^./, character => character.toUpperCase())
  .trim();

const parseLabel = text => {
  const match = safeString(text).match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]+)/);
  return match
    ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() }
    : { isLabeled: false, label: '', value: safeString(text) };
};

const splitEditableClauses = (value, fieldPath) => {
  const source = safeString(value); const out = []; let current = ''; let depth = 0;
  const push = () => { if (current.trim()) out.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || '';
    const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next)
      && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord)
      && !/\b[A-Z]$/.test(current) && !/\d$/.test(current);
    const safeSemicolon = character === ';' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0;
    const safeComma = character === ',' && COMMA_ARRAY_FIELDS.has(fieldPath) && depth === 0;
    if (safePeriod || safeSemicolon || safeComma) {
      push();
      while (/\s/.test(source[index + 1] || '')) index += 1;
    } else current += character;
  }
  push();
  return out.length ? out : [source];
};

const formatObjectValue = value => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(item => formatObjectValue(item)).join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, nested]) => hasVal(nested))
      .map(([key, nested]) => `${formatLabel(key)}: ${formatObjectValue(nested)}`)
      .join(', ');
  }
  return safeString(value);
};

const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record => {
  if (record?.transplant_assessment) return Array.isArray(record.transplant_assessment) ? record.transplant_assessment : [record.transplant_assessment];
  if (record?.documentData) {
    const inner = record.documentData;
    if (Array.isArray(inner)) return inner;
    if (inner?.transplant_assessment) return Array.isArray(inner.transplant_assessment) ? inner.transplant_assessment : [inner.transplant_assessment];
    return [inner];
  }
  if (record?.records) return Array.isArray(record.records) ? record.records : [record.records];
  return [record];
}).filter(record => record && typeof record === 'object');

const TransplantAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const fieldBody = (record, fn, sid) => {
    const value = record[fn];
    if (!hasVal(value)) return [];
    const label = FIELD_LABELS[fn] || formatLabel(fn);
    let elements = [];
    let rowNumber = 1;

    if (DATE_FIELDS.has(fn)) {
      elements.push(<Text key={`${fn}-date`} style={styles.listItem}>1. {formatDate(value)}</Text>);
    } else if (ARRAY_FIELDS.has(fn)) {
      const items = Array.isArray(value) ? value : [value];
      items.filter(hasVal).forEach((item, itemIndex) => {
        splitEditableClauses(formatObjectValue(item), fn).forEach((clause, clauseIndex) => {
          const parsed = parseLabel(clause);
          const row = <Text key={`${fn}-${itemIndex}-${clauseIndex}`} style={styles.listItem}>{rowNumber++}. {safeString(parsed.isLabeled ? parsed.value : clause)}</Text>;
          elements.push(parsed.isLabeled
            ? <View key={`${fn}-${itemIndex}-${clauseIndex}-group`} wrap={false}><Text style={styles.subLabel}>{safeString(parsed.label)}</Text>{row}</View>
            : row);
        });
      });
    } else if (OBJECT_FIELDS.has(fn)) {
      Object.entries(value).filter(([, nested]) => hasVal(nested)).forEach(([key, nested], objectIndex) => {
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          const nestedRows = Object.entries(nested).filter(([, leaf]) => hasVal(leaf));
          nestedRows.forEach(([nestedKey, leaf], nestedIndex) => {
            elements.push(
              <View key={`${fn}-${objectIndex}-${nestedIndex}`} wrap={false}>
                {nestedIndex === 0 && <Text style={styles.subLabel}>{formatLabel(key)}</Text>}
                <Text style={styles.subLabel}>{formatLabel(nestedKey)}</Text>
                <Text style={styles.listItem}>{rowNumber++}. {formatObjectValue(leaf)}</Text>
              </View>
            );
          });
        } else {
          elements.push(
            <View key={`${fn}-${objectIndex}`} wrap={false}>
              <Text style={styles.subLabel}>{formatLabel(key)}</Text>
              <Text style={styles.listItem}>{rowNumber++}. {formatObjectValue(nested)}</Text>
            </View>
          );
        }
      });
    } else {
      splitEditableClauses(value, fn).forEach((clause, clauseIndex) => {
        const parsed = parseLabel(clause);
        const row = <Text key={`${fn}-${clauseIndex}`} style={styles.listItem}>{rowNumber++}. {safeString(parsed.isLabeled ? parsed.value : clause)}</Text>;
        elements.push(parsed.isLabeled
          ? <View key={`${fn}-${clauseIndex}-group`} wrap={false}><Text style={styles.subLabel}>{safeString(parsed.label)}</Text>{row}</View>
          : row);
      });
    }

    if (!sameAsTitle(label, sid) && elements.length) {
      const [first, ...rest] = elements;
      elements = [
        <View key={`${fn}-field`} wrap={false}><Text style={styles.fieldLabel}>{safeString(label)}</Text>{first}</View>,
        ...rest,
      ];
    }
    return elements;
  };

  const renderSection = (record, sid) => {
    let body = [];
    SECTION_FIELDS[sid].forEach(fn => { body = body.concat(fieldBody(record, fn, sid)); });
    if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sid}-${index}` }));
    const [first, ...rest] = body;
    return (
      <View key={sid} wrap={body.length > 8 ? true : false}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
          {first}
        </View>
        {rest}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Transplant Assessment</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No transplant assessment records available</Text>}
        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>{`Transplant Assessment ${index + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TransplantAssessmentDocumentPDFTemplate;
