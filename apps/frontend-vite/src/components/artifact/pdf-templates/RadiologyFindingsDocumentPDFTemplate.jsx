/**
 * RadiologyFindingsDocumentPDFTemplate.jsx
 * Canonical LETTER export for radiology_findings.
 * Mirrors the screen hierarchy: document -> record -> section -> labeled field/list.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.45, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 22 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 22 },
  recordHeader: { marginBottom: 14 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 9 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.45, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.45, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 5, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#4b5563', marginTop: 24 },
});

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    if (Number.isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const safeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && value.$date) return formatDate(value);
  return String(value);
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;]\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence && !/^[;.,!?]+$/.test(sentence));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match
    ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() }
    : { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = [];
  let current = '';
  let depth = 0;
  for (const character of text) {
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const humanizeKey = (key) => String(key ?? '')
  .replace(/[_\-.]+/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, character => character.toUpperCase());

const flattenObject = (object, parentLabel = '') => {
  const rows = [];
  if (!object || typeof object !== 'object') return rows;
  Object.entries(object).forEach(([key, value]) => {
    if (!hasVal(value)) return;
    const label = parentLabel ? `${parentLabel} — ${humanizeKey(key)}` : humanizeKey(key);
    if (Array.isArray(value)) {
      value.filter(hasVal).forEach((item, index) => {
        if (item && typeof item === 'object') rows.push(...flattenObject(item, `${label} ${index + 1}`));
        else rows.push({ label: `${label} ${index + 1}`, value: safeString(item) });
      });
      return;
    }
    if (value && typeof value === 'object' && !value.$date) {
      rows.push(...flattenObject(value, label));
      return;
    }
    rows.push({ label, value: safeString(value) });
  });
  return rows;
};

const renderField = (label, value, { date = false } = {}) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Text style={styles.fieldValue}>1. {date ? formatDate(value) : safeString(value)}</Text>
    </View>
  );
};

const renderSentenceField = (label, value) => {
  if (!hasVal(value)) return null;
  const rows = [];
  let number = 1;
  splitBySentence(safeString(value)).forEach(sentence => {
    const parsed = parseLabel(sentence);
    if (parsed.isLabeled) {
      rows.push({ kind: 'subtitle', value: parsed.label });
      splitByComma(parsed.value).forEach(item => rows.push({ kind: 'item', value: item, number: number++ }));
    } else {
      rows.push({ kind: 'item', value: sentence, number: number++ });
    }
  });
  if (!rows.length) return null;
  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((row, index) => row.kind === 'subtitle'
        ? <Text key={index} style={styles.nestedSubtitle}>{row.value}</Text>
        : <Text key={index} style={styles.listItem}>{row.number}. {row.value}</Text>)}
    </View>
  );
};

const renderSection = (title, renderedFields) => {
  const fields = renderedFields.filter(Boolean);
  if (!fields.length) return null;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {React.cloneElement(fields[0], { key: 'first' })}
      </View>
      {fields.slice(1).map((field, index) => React.cloneElement(field, { key: `field-${index + 1}` }))}
    </View>
  );
};

const SECTION_CONFIGS = [
  { title: 'Study Information', fields: [
    { key: 'modalityUsed', label: 'Modality', sentence: true },
    { key: 'date', label: 'Date', date: true },
    { key: 'facility', label: 'Facility', sentence: true },
    { key: 'provider', label: 'Provider', sentence: true },
  ] },
  { title: 'Technique', fields: [{ key: 'technique', label: 'Technique', sentence: true }] },
  { title: 'Contrast Information', nested: 'contrast', fields: [
    { key: 'type', label: 'Contrast Type', sentence: true },
    { key: 'amount', label: 'Contrast Amount', sentence: true },
    { key: 'reaction', label: 'Contrast Reaction', sentence: true },
  ] },
  { title: 'Comparison', fields: [{ key: 'comparison', label: '', sentence: true }] },
  { title: 'Impression', fields: [{ key: 'impression', label: '', sentence: true }] },
  { title: 'RADS Scores', fields: [
    { key: 'biRads', label: 'BI-RADS' },
    { key: 'tirads', label: 'TI-RADS' },
    { key: 'pirads', label: 'PI-RADS' },
  ] },
  { title: 'Clinical Summary', fields: [
    { key: 'assessment', label: 'Assessment', sentence: true },
    { key: 'plan', label: 'Plan', sentence: true },
    { key: 'notes', label: 'Notes', sentence: true },
    { key: 'status', label: 'Status' },
  ] },
];

const renderConfiguredSection = (record, config) => {
  const source = config.nested ? record[config.nested] : record;
  if (!source || typeof source !== 'object') return null;
  const rendered = config.fields.map(field => field.sentence
    ? renderSentenceField(field.label, source[field.key])
    : renderField(field.label, source[field.key], { date: field.date }));
  return renderSection(config.title, rendered);
};

const renderFindingsSection = (findings) => {
  if (!Array.isArray(findings) || !findings.some(Boolean)) return null;
  const groups = findings.filter(Boolean).map((finding, findingIndex) => {
    const fields = [
      ['Anatomic Location', finding.anatomicLocation],
      ['Finding', finding.finding],
      ['Size', finding.size],
      ['Characteristics', finding.characteristics],
      ['Significance', finding.significance],
    ].filter(([, value]) => hasVal(value));
    return fields.length ? { findingIndex, fields } : null;
  }).filter(Boolean);
  if (!groups.length) return null;
  const renderFindingField = ([label, value], key) => (
    <View key={key} style={styles.fieldBox} wrap={false}>
      <Text style={styles.nestedSubtitle}>{label}</Text>
      <Text style={styles.fieldValue}>1. {safeString(value)}</Text>
    </View>
  );
  const firstGroup = groups[0];
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>Imaging Findings</Text>
        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>Finding {firstGroup.findingIndex + 1}</Text>
          {renderFindingField(firstGroup.fields[0], 'first-finding-field')}
        </View>
      </View>
      {firstGroup.fields.slice(1).map((field, index) => renderFindingField(field, `first-${index + 1}`))}
      {groups.slice(1).map(group => (
        <React.Fragment key={group.findingIndex}>
          <View style={styles.fieldBox} wrap={false}>
            <Text style={styles.fieldLabel}>Finding {group.findingIndex + 1}</Text>
            {renderFindingField(group.fields[0], `group-${group.findingIndex}-first`)}
          </View>
          {group.fields.slice(1).map((field, index) => renderFindingField(field, `group-${group.findingIndex}-${index + 1}`))}
        </React.Fragment>
      ))}
    </View>
  );
};

const renderResultsSection = (results) => {
  const rows = flattenObject(results);
  return renderSection('Results', rows.map((row, index) => (
    <View key={index} style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{row.label}</Text>
      <Text style={styles.fieldValue}>1. {row.value}</Text>
    </View>
  )));
};

const renderRecommendationsSection = (recommendations) => {
  if (!Array.isArray(recommendations) || !recommendations.some(Boolean)) return null;
  const groups = [];
  recommendations.forEach((recommendation, originalIndex) => {
    if (!recommendation) return;
    const dateValue = typeof recommendation === 'object' ? recommendation.date : null;
    const dateKey = dateValue ? String(dateValue.$date || dateValue).slice(0, 10) : '__undated__';
    let group = groups.find(item => item.dateKey === dateKey);
    if (!group) { group = { dateKey, dateValue, entries: [] }; groups.push(group); }
    group.entries.push({ recommendation, originalIndex });
  });
  return renderSection('Recommendations', groups.map(group => (
    <View key={group.dateKey} style={styles.fieldBox} wrap={group.entries.length <= 5}>
      {group.dateValue ? <Text style={styles.fieldLabel}>{formatDate(group.dateValue)}</Text> : null}
      {group.entries.map(({ recommendation, originalIndex }) => (
        <Text key={originalIndex} style={styles.listItem}>
          {originalIndex + 1}. {typeof recommendation === 'object' ? (recommendation.recommendation || 'N/A') : safeString(recommendation)}
        </Text>
      ))}
    </View>
  )));
};

const RadiologyFindingsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    const input = Array.isArray(data) ? data : [data];
    return input.flatMap(record => {
      if (record?.radiology_findings) return Array.isArray(record.radiology_findings) ? record.radiology_findings : [record.radiology_findings];
      if (record?.documentData) {
        const nested = record.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.radiology_findings) return Array.isArray(nested.radiology_findings) ? nested.radiology_findings : [nested.radiology_findings];
        return [nested];
      }
      return [record];
    }).filter(record => record && typeof record === 'object');
  }, [data]);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}>
          <Text style={styles.documentTitle}>Radiology Findings</Text>
        </View>
        {!records.length ? <Text style={styles.noDataText}>No data available</Text> : null}
        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer}>
            {recordIndex > 0 ? <View style={styles.separator} /> : null}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Radiology Finding {recordIndex + 1}</Text>
            </View>
            {SECTION_CONFIGS.slice(0, 3).map(config => <React.Fragment key={config.title}>{renderConfiguredSection(record, config)}</React.Fragment>)}
            {renderFindingsSection(record.findings)}
            {SECTION_CONFIGS.slice(3, 6).map(config => <React.Fragment key={config.title}>{renderConfiguredSection(record, config)}</React.Fragment>)}
            {renderResultsSection(record.results)}
            {renderRecommendationsSection(record.recommendations)}
            {renderConfiguredSection(record, SECTION_CONFIGS[6])}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RadiologyFindingsDocumentPDFTemplate;
