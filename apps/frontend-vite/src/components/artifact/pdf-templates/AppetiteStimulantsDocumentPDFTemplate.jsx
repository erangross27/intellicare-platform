/**
 * AppetiteStimulantsDocumentPDFTemplate.jsx
 * Canonical box-free PDF for appetite_stimulants.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', paddingBottom: 6, marginBottom: 24 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 16 },
  recordSeparator: { borderTopWidth: 1, borderTopColor: '#999999', borderTopStyle: 'solid', marginTop: 20, marginBottom: 20 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', paddingBottom: 4, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', paddingBottom: 2, marginBottom: 4 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.45, paddingLeft: 8 },
  noDataText: { fontSize: 14, textAlign: 'center', marginTop: 40 },
});

const SECTION_CONFIGS = [
  { title: 'Provider Information', fields: ['provider', 'facility'] },
  { title: 'Overview', fields: ['date', 'type', 'status', 'considered'] },
  { title: 'Medications', fields: ['medications'] },
  { title: 'Reason', fields: ['reason'] },
  { title: 'Findings', fields: ['findings'] },
  { title: 'Assessment', fields: ['assessment'] },
  { title: 'Plan', fields: ['plan'] },
  { title: 'Results', fields: ['results'] },
  { title: 'Recommendations', fields: ['recommendations'] },
  { title: 'Notes', fields: ['notes'] },
];

const FIELD_LABELS = {
  provider: 'Provider',
  facility: 'Facility',
  date: 'Date',
  type: 'Type',
  status: 'Status',
  considered: 'Considered',
  medications: 'Medications',
  reason: 'Reason',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const COMMA_SPLIT_FIELDS = ['reason', 'assessment'];
const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'Reviewed'];

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  if (typeof value === 'object') return Object.values(value).some(hasVal);
  return true;
};

const isScalar = (value) => value === null || typeof value !== 'object';
const scalarText = (value) => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');

const humanizeKey = (key) => {
  const text = String(key ?? '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(value);
  }
};

const toInputDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
  } catch {
    return String(value);
  }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const protectedText = text.replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\./gi, '$1<dot>');
  return protectedText.split(/[.;]\s+/).map(part => part.replace(/<dot>/g, '.').replace(/[;.]+$/, '').trim()).filter(Boolean);
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [String(text || '')];
  const result = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(') { depth += 1; current += character; }
    else if (character === ')') { depth = Math.max(0, depth - 1); current += character; }
    else if (character === ',' && depth === 0 && !(/\d/.test(text[index - 1] || '') && /\d/.test(text[index + 1] || ''))) {
      const item = current.trim();
      if (item) result.push(item);
      current = '';
    } else current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const shouldSplitSentenceCommas = (field, sentence) => field === 'plan' && /^Monitor\b/i.test(String(sentence || '').trim());

const canonicalStatus = (value) => {
  const raw = String(value || '').trim();
  return STATUS_OPTIONS.find(option => option.toLowerCase() === raw.toLowerCase()) || raw;
};

const narrativeRows = (field, value) => {
  const rows = [];
  splitBySentence(String(value || '')).forEach(sentence => {
    if (COMMA_SPLIT_FIELDS.includes(field) || shouldSplitSentenceCommas(field, sentence)) {
      splitByComma(sentence).map(item => item.replace(/[;.]+$/, '').trim()).filter(Boolean).forEach(item => rows.push(item));
    } else {
      rows.push(sentence);
    }
  });
  return rows;
};

const objectRows = (value, label = '') => {
  if (!hasVal(value)) return [];
  if (isScalar(value)) return [{ label, value: scalarText(value) }];
  if (Array.isArray(value)) {
    const rows = [];
    value.filter(hasVal).forEach((item, itemIndex) => {
      if (isScalar(item)) rows.push({ label: itemIndex === 0 ? label : '', value: scalarText(item), numbered: true });
      else rows.push(...objectRows(item, itemIndex === 0 ? label : ''));
    });
    return rows;
  }
  return Object.entries(value).filter(([, child]) => hasVal(child)).flatMap(([key, child]) => objectRows(child, humanizeKey(key)));
};

const recommendationRows = (value) => {
  const entries = (Array.isArray(value) ? value : []).filter(item => item && (item.recommendation || item.date));
  const groups = new Map();
  entries.forEach((item, itemIndex) => {
    const key = toInputDate(item.date) || `no-date-${itemIndex}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  const rows = [];
  let number = 1;
  groups.forEach((items, key) => {
    if (!key.startsWith('no-date-')) rows.push({ value: formatDate(items[0].date), subtitle: true });
    items.forEach(item => splitBySentence(String(item.recommendation || '')).forEach(clause => {
      rows.push({ value: clause, number: number++ });
    }));
  });
  return rows;
};

const fieldRows = (field, value) => {
  if (!hasVal(value) && !(field === 'considered' && value === false)) return [];
  if (field === 'date') return [{ value: formatDate(value) }];
  if (field === 'status') return [{ value: canonicalStatus(value) }];
  if (field === 'considered') return [{ value: value ? 'Yes' : 'No' }];
  if (field === 'medications') return (Array.isArray(value) ? value : [value]).filter(hasVal).map((item, index) => ({ value: scalarText(item), number: index + 1 }));
  if (field === 'results') return objectRows(value);
  if (field === 'recommendations') return recommendationRows(value);
  if (['reason', 'findings', 'assessment', 'plan', 'notes'].includes(field)) {
    const rows = narrativeRows(field, value);
    return rows.map((row, index) => ({ value: row, number: rows.length > 1 ? index + 1 : null }));
  }
  return [{ value: scalarText(value) }];
};

const sectionUnits = (section, record) => {
  const units = [];
  section.fields.forEach(field => {
    const rows = fieldRows(field, record[field]);
    if (!rows.length) return;
    const label = FIELD_LABELS[field] || humanizeKey(field);
    const showLabel = label.toLowerCase() !== section.title.toLowerCase();
    rows.forEach((row, rowIndex) => units.push({
      ...row,
      fieldLabel: showLabel && rowIndex === 0 ? label : '',
    }));
  });
  return units;
};

const renderUnit = (unit, key, sectionTitle) => (
  <View key={key} style={styles.fieldUnit} wrap={false}>
    {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
    {unit.fieldLabel ? <Text style={styles.fieldLabel}>{unit.fieldLabel}</Text> : null}
    {unit.label ? <Text style={styles.nestedSubtitle}>{unit.label}</Text> : null}
    {unit.subtitle ? <Text style={styles.nestedSubtitle}>{unit.value}</Text> : <Text style={styles.fieldValue}>{unit.number ? `${unit.number}. ` : ''}{unit.value}</Text>}
  </View>
);

const renderSections = (record, titles, keyPrefix) => SECTION_CONFIGS.filter(section => titles.includes(section.title)).map(section => {
  const units = sectionUnits(section, record);
  if (!units.length) return null;
  return (
    <View key={`${keyPrefix}-${section.title}`} style={styles.section}>
      {units.map((unit, unitIndex) => renderUnit(unit, `${keyPrefix}-${section.title}-${unitIndex}`, unitIndex === 0 ? section.title : ''))}
    </View>
  );
});

const hasSectionData = (record, titles) => SECTION_CONFIGS.some(section => titles.includes(section.title) && sectionUnits(section, record).length > 0);

const AppetiteStimulantsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let source = Array.isArray(data) ? data : [data];
    source = source.flatMap(record => {
      if (record?.appetite_stimulants) return Array.isArray(record.appetite_stimulants) ? record.appetite_stimulants : [record.appetite_stimulants];
      if (record?.data) {
        const nested = record.data;
        if (Array.isArray(nested)) return nested;
        if (nested?.appetite_stimulants) return Array.isArray(nested.appetite_stimulants) ? nested.appetite_stimulants : [nested.appetite_stimulants];
        return [nested];
      }
      if (record?.documentData) {
        const nested = record.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.appetite_stimulants) return Array.isArray(nested.appetite_stimulants) ? nested.appetite_stimulants : [nested.appetite_stimulants];
        return [nested];
      }
      return [record];
    });
    return source.filter(record => record && typeof record === 'object');
  }, [data]);

  if (records.length === 0) {
    return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Appetite Stimulants</Text><Text style={styles.noDataText}>No data available</Text></Page></Document>;
  }

  const primaryTitles = ['Provider Information', 'Overview', 'Medications'];
  const middleTitles = ['Reason', 'Findings', 'Assessment', 'Plan'];
  const extendedTitles = ['Results', 'Recommendations'];

  return (
    <Document>
      {records.flatMap((record, recordIndex) => {
        const hasExtended = hasSectionData(record, extendedTitles);
        const middleWithNotes = hasExtended ? middleTitles : [...middleTitles, 'Notes'];
        const extendedWithNotes = [...extendedTitles, 'Notes'];
        const pages = [
          <Page key={`${recordIndex}-primary`} size="LETTER" style={styles.page}>
            <Text style={styles.documentTitle}>Appetite Stimulants</Text>
            <Text style={styles.recordTitle}>{`Appetite Stimulant ${recordIndex + 1}`}</Text>
            {renderSections(record, primaryTitles, `${recordIndex}-primary`)}
          </Page>,
        ];
        if (hasSectionData(record, middleWithNotes)) pages.push(<Page key={`${recordIndex}-middle`} size="LETTER" style={styles.page}>{renderSections(record, middleWithNotes, `${recordIndex}-middle`)}</Page>);
        if (hasExtended && hasSectionData(record, extendedWithNotes)) pages.push(<Page key={`${recordIndex}-extended`} size="LETTER" style={styles.page}>{renderSections(record, extendedWithNotes, `${recordIndex}-extended`)}</Page>);
        return pages;
      })}
    </Document>
  );
};

export default AppetiteStimulantsDocumentPDFTemplate;
