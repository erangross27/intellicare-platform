/**
 * Canonical box-free PDF for arterial_blood_gases.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', paddingBottom: 6, marginBottom: 24 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 16 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', paddingBottom: 4, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', paddingBottom: 2, marginBottom: 4 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.45, paddingLeft: 8 },
  noDataText: { fontSize: 14, textAlign: 'center', marginTop: 40 },
});

const SECTION_CONFIGS = [
  { title: 'Assessment Info', fields: ['assessmentDate', 'assessmentTime', 'clinicalStatus'] },
  { title: 'Vital Signs', fields: ['vitalSigns'] },
  { title: 'Interventions', fields: ['interventions'] },
  { title: 'Response', fields: ['response'] },
  { title: 'Plan', fields: ['plan'] },
  { title: 'Recommendations', fields: ['recommendations'] },
];
const FIELD_LABELS = {
  assessmentDate: 'Assessment Date',
  assessmentTime: 'Assessment Time',
  clinicalStatus: 'Clinical Status',
  vitalSigns: 'Vital Signs',
  interventions: 'Interventions',
  response: 'Response',
  plan: 'Plan',
  recommendations: 'Recommendations',
};
const COMMA_SPLIT_FIELDS = ['vitalSigns', 'interventions', 'response'];
const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'Reviewed'];

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasValue);
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return true;
};

const safeString = (value) => String(value ?? '')
  .replace(/[μµ]/g, 'u')
  .replace(/°/g, ' deg')
  .replace(/±/g, '+/-')
  .replace(/≥/g, '>=')
  .replace(/≤/g, '<=')
  .replace(/→/g, '->')
  .replace(/²/g, '2')
  .replace(/³/g, '3');

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return safeString(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(value);
  }
};
const toInputDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const protectedText = text.replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\./gi, '$1<dot>');
  return protectedText.split(/[.;]\s+/).map(part => part.replace(/<dot>/g, '.').replace(/[;.]+$/, '').trim()).filter(Boolean);
};

const splitGuardedComma = (text, protectThen = true) => {
  const source = String(text || '');
  const parts = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(' || character === '[') { depth += 1; current += character; continue; }
    if (character === ')' || character === ']') { depth = Math.max(0, depth - 1); current += character; continue; }
    if (character !== ',' || depth > 0) { current += character; continue; }
    const before = current.trim();
    const remaining = source.slice(index + 1);
    const after = remaining.trimStart();
    const nextWord = (after.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const protectedComma = (/[\d]$/.test(before) && /^\d{3}\b/.test(after)) || remaining.length === after.length || ['and', 'or'].includes(nextWord) || (protectThen && nextWord === 'then');
    if (protectedComma) current += character;
    else { if (before) parts.push(before); current = ''; }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : [source];
};

const fieldRows = (field, value) => {
  const rows = [];
  splitBySentence(String(value || '')).forEach(sentence => {
    const parts = COMMA_SPLIT_FIELDS.includes(field) ? splitGuardedComma(sentence, field !== 'interventions') : [sentence];
    parts.map(part => part.replace(/[;.]+$/, '').trim()).filter(Boolean).forEach(part => rows.push(part));
  });
  return rows;
};

const canonicalStatus = (value) => {
  const raw = String(value || '').trim();
  return STATUS_OPTIONS.find(option => option.toLowerCase() === raw.toLowerCase()) || raw;
};

const recommendationRows = (value) => {
  const entries = (Array.isArray(value) ? value : []).map((item, itemIndex) => ({ item, itemIndex })).filter(({ item }) => item && (item.recommendation || item.date));
  const groups = new Map();
  entries.forEach(entry => {
    const key = toInputDate(entry.item.date) || `no-date-${entry.itemIndex}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry.item);
  });
  const rows = [];
  let number = 1;
  groups.forEach((items, key) => {
    if (!key.startsWith('no-date-')) rows.push({ value: formatDate(items[0].date), subtitle: true });
    items.forEach(item => fieldRows('recommendations', item.recommendation).forEach(value => rows.push({ value, number: number++ })));
  });
  return rows;
};

const rowsForField = (field, value) => {
  if (!hasValue(value)) return [];
  if (field === 'assessmentDate') return [{ value: formatDate(value) }];
  if (field === 'clinicalStatus') return [{ value: canonicalStatus(value) }];
  if (field === 'recommendations') return recommendationRows(value);
  if (['vitalSigns', 'interventions', 'response', 'plan'].includes(field)) {
    const rows = fieldRows(field, value);
    return rows.map((row, index) => ({ value: row, number: rows.length > 1 ? index + 1 : null }));
  }
  return [{ value: safeString(value) }];
};

const sectionUnits = (section, record) => {
  const units = [];
  section.fields.forEach(field => {
    const rows = rowsForField(field, record[field]);
    const label = FIELD_LABELS[field] || field;
    const showLabel = label.toLowerCase() !== section.title.toLowerCase();
    rows.forEach((row, index) => units.push({ ...row, fieldLabel: showLabel && index === 0 ? label : '' }));
  });
  return units;
};

const renderUnit = (unit, key, sectionTitle) => (
  <View key={key} style={styles.fieldUnit} wrap={false}>
    {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
    {unit.fieldLabel ? <Text style={styles.fieldLabel}>{unit.fieldLabel}</Text> : null}
    {unit.subtitle ? <Text style={styles.nestedSubtitle}>{safeString(unit.value)}</Text> : <Text style={styles.fieldValue}>{unit.number ? `${unit.number}. ` : ''}{safeString(unit.value)}</Text>}
  </View>
);

const renderSections = (record, titles, keyPrefix) => SECTION_CONFIGS.filter(section => titles.includes(section.title)).map(section => {
  const units = sectionUnits(section, record);
  if (!units.length) return null;
  return <View key={`${keyPrefix}-${section.title}`} style={styles.section}>{units.map((unit, index) => renderUnit(unit, `${keyPrefix}-${section.title}-${index}`, index === 0 ? section.title : ''))}</View>;
});
const hasSectionData = (record, titles) => SECTION_CONFIGS.some(section => titles.includes(section.title) && sectionUnits(section, record).length);

const ArterialBloodGasesDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let values = Array.isArray(data) ? data : [data];
    values = values.flatMap(value => {
      if (value?.arterial_blood_gases) return Array.isArray(value.arterial_blood_gases) ? value.arterial_blood_gases : [value.arterial_blood_gases];
      if (value?.data) {
        if (Array.isArray(value.data)) return value.data;
        if (value.data?.arterial_blood_gases) return Array.isArray(value.data.arterial_blood_gases) ? value.data.arterial_blood_gases : [value.data.arterial_blood_gases];
        return [value.data];
      }
      if (value?.documentData) {
        if (Array.isArray(value.documentData)) return value.documentData;
        if (value.documentData?.arterial_blood_gases) return Array.isArray(value.documentData.arterial_blood_gases) ? value.documentData.arterial_blood_gases : [value.documentData.arterial_blood_gases];
        return [value.documentData];
      }
      return [value];
    });
    return values.filter(value => value && typeof value === 'object' && SECTION_CONFIGS.some(section => sectionUnits(section, value).length));
  }, [data]);

  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Arterial Blood Gases</Text><Text style={styles.noDataText}>No data available</Text></Page></Document>;

  const firstPageSections = ['Assessment Info', 'Vital Signs'];
  const secondPageSections = ['Interventions', 'Response', 'Plan', 'Recommendations'];
  return (
    <Document>
      {records.flatMap((record, recordIndex) => {
        const pages = [
          <Page key={`${recordIndex}-primary`} size="LETTER" style={styles.page}>
            <Text style={styles.documentTitle}>Arterial Blood Gases</Text>
            <Text style={styles.recordTitle}>{`Arterial Blood Gases ${recordIndex + 1}`}</Text>
            {renderSections(record, firstPageSections, `${recordIndex}-primary`)}
          </Page>,
        ];
        if (hasSectionData(record, secondPageSections)) pages.push(<Page key={`${recordIndex}-secondary`} size="LETTER" style={styles.page}>{renderSections(record, secondPageSections, `${recordIndex}-secondary`)}</Page>);
        return pages;
      })}
    </Document>
  );
};

export default ArterialBloodGasesDocumentPDFTemplate;
