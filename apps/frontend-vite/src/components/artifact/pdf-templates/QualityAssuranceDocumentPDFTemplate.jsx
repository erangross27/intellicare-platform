/** Canonical box-free LETTER PDF for quality_assurance. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { paddingBottom: 12 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginTop: 12, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 7, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 5, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#333333', marginTop: 40 },
});

const SECTIONS = [
  { title: 'Record Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'provider', label: 'Provider' },
    { key: 'facility', label: 'Facility' },
    { key: 'status', label: 'Status' },
    { key: 'type', label: 'Type' },
  ] },
  { title: 'Outside Consultation Recommendation', fields: [
    { key: 'outsideConsultationRecommendation.recommended', label: 'Recommended' },
    { key: 'outsideConsultationRecommendation.institution', label: 'Institution' },
    { key: 'outsideConsultationRecommendation.reason', label: 'Reason' },
    { key: 'outsideConsultationRecommendation.specialty', label: 'Specialty' },
  ] },
  { title: 'Peer Review', fields: [{ key: 'peerReview', label: 'Peer Review' }] },
  { title: 'Clinical Details', fields: [
    { key: 'findings', label: 'Findings', commaSplit: true },
    { key: 'assessment', label: 'Assessment', commaSplit: true },
    { key: 'plan', label: 'Plan', commaSplit: true },
  ] },
  { title: 'Recommendations', fields: [
    { key: 'recommendations', label: 'Recommendations', type: 'recommendations' },
    { key: 'qualityMetrics', label: 'Quality Metrics', type: 'metrics' },
    { key: 'results', label: 'Results', type: 'object' },
  ] },
  { title: 'Notes', fields: [{ key: 'notes', label: 'Notes', commaSplit: true }] },
];

const hasVal = value => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const safeString = value => String(value ?? '')
  .replace(/×/g, 'x').replace(/[μµ]/g, 'u')
  .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-').replace(/…/g, '...');

const formatDate = value => {
  if (!value) return '';
  const date = new Date(value.$date || value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1970) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

const getValue = (record, path) => path.split('.').reduce((value, key) => value?.[key], record);
const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();
const humanizeKey = key => String(key || '').replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, char => char.toUpperCase());
const groupRecommendationsByDate = items => {
  const groups = [];
  const byDate = new Map();
  (Array.isArray(items) ? items : []).forEach(item => {
    if (!item || typeof item !== 'object') return;
    const dateKey = formatDate(item.date) || 'no-date';
    if (!byDate.has(dateKey)) {
      const group = { dateValue: item.date, items: [] };
      byDate.set(dateKey, group);
      groups.push(group);
    }
    byDate.get(dateKey).items.push(item);
  });
  return groups;
};

const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: String(text || '') };
};

const splitBySentence = text => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+|$)/)
    .map(item => item.trim()).filter(item => item && !/^[;.,!?]+$/.test(item));
};

const splitByComma = text => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') { depth += 1; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const fieldRows = (record, field, sectionTitle) => {
  const value = getValue(record, field.key);
  if (!hasVal(value)) return [];
  const fieldLabel = sameAsTitle(field.label, sectionTitle) ? '' : field.label;

  if (field.type === 'date') {
    const display = formatDate(value);
    return display ? [{ fieldLabel, text: display }] : [];
  }
  if (field.type === 'recommendations') {
    return groupRecommendationsByDate(value).flatMap(group => {
      const recommendations = group.items.filter(item => hasVal(item.recommendation));
      return recommendations.map((item, index) => ({
        fieldLabel: '',
        subLabel: index === 0 ? formatDate(group.dateValue) : '',
        text: safeString(item.recommendation),
      }));
    });
  }
  if (field.type === 'metrics') {
    return (Array.isArray(value) ? value : []).map((item, index) => {
      const parsed = parseLabel(item);
      return { fieldLabel: index === 0 ? fieldLabel : '', subLabel: parsed.isLabeled ? parsed.label : '', text: parsed.isLabeled ? parsed.value : safeString(item) };
    });
  }
  if (field.type === 'object') {
    return Object.entries(value || {}).filter(([, item]) => hasVal(item)).map(([key, item], index) => ({
      fieldLabel: index === 0 ? fieldLabel : '', subLabel: humanizeKey(key), text: typeof item === 'object' ? safeString(JSON.stringify(item)) : safeString(item),
    }));
  }

  const rows = [];
  splitBySentence(safeString(typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value)).forEach(sentence => {
    const parsed = parseLabel(sentence);
    const parts = field.commaSplit ? splitByComma(parsed.isLabeled ? parsed.value : sentence) : [parsed.isLabeled ? parsed.value : sentence];
    parts.forEach((part, index) => rows.push({
      fieldLabel: rows.length === 0 ? fieldLabel : '',
      subLabel: parsed.isLabeled && index === 0 ? parsed.label : '',
      text: part,
    }));
  });
  return rows;
};

const RowContent = ({ row, number }) => (
  <>
    {row.fieldLabel && <Text style={styles.fieldLabel}>{safeString(row.fieldLabel)}</Text>}
    {row.subLabel && <Text style={styles.nestedSubtitle}>{safeString(row.subLabel)}</Text>}
    <Text style={styles.listItem}>{number}. {safeString(row.text)}</Text>
  </>
);

const renderSection = (record, section, sectionIndex) => {
  const rows = section.fields.flatMap(field => fieldRows(record, field, section.title));
  if (!rows.length) return null;
  const [first, ...rest] = rows;
  return (
    <React.Fragment key={`section-${sectionIndex}`}>
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.fieldBox} wrap={false}><RowContent row={first} number={1} /></View>
      </View>
      {rest.map((row, index) => (
        <View key={`section-${sectionIndex}-row-${index}`} style={styles.fieldBox} wrap={false}>
          <RowContent row={row} number={index + 2} />
        </View>
      ))}
    </React.Fragment>
  );
};

const unwrapRecords = data => {
  if (!data) return [];
  return (Array.isArray(data) ? data : [data]).flatMap(record => {
    if (record?.quality_assurance) return Array.isArray(record.quality_assurance) ? record.quality_assurance : [record.quality_assurance];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.quality_assurance) return Array.isArray(nested.quality_assurance) ? nested.quality_assurance : [nested.quality_assurance];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const QualityAssuranceDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => unwrapRecords(data), [data]);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}>
          <Text style={styles.documentTitle}>Quality Assurance</Text>
        </View>
        {!records.length && <Text style={styles.noDataText}>No data available</Text>}
        {records.map((record, recordIndex) => (
          <View key={`record-${recordIndex}`} style={styles.recordContainer} break={recordIndex > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Quality Assurance {recordIndex + 1}</Text>
            </View>
            {SECTIONS.map((section, sectionIndex) => renderSection(record, section, sectionIndex))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default QualityAssuranceDocumentPDFTemplate;
