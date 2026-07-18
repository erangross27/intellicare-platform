import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.35, color: '#000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'solid', marginBottom: 12 },
  block: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999', borderBottomStyle: 'solid', marginBottom: 3 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  fieldValue: { fontSize: 14 },
  listItem: { fontSize: 14, paddingLeft: 10, marginBottom: 2 },
  noDataText: { fontSize: 14, marginTop: 30 }
});

const COMMA_OBJECT_PATHS = ['pgtTesting.result'];
const COMMA_STRING_FIELDS = ['notes'];
const WHOLE_STRING_FIELDS = ['provider', 'facility'];
const isDatePath = path => /(^|\.)(date|lmp|lastMenstrualPeriod|dateOfConception|estimatedDueDate|datePerformed|customDate)$/i.test(path);
const isEmptyDeep = value => value == null || value === '' || (Array.isArray(value) ? !value.some(item => !isEmptyDeep(item)) : typeof value === 'object' ? Object.values(value).every(isEmptyDeep) : false);
const fmt = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const humanize = key => String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const formatDate = value => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return fmt(value); }
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim(), labeled: true } : { value: String(text || ''), labeled: false };
};
const splitByComma = text => {
  const source = String(text || ''); const result = []; let current = ''; let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
const splitSentences = text => String(text || '')
  .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;]\s+/)
  .map(value => value.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter(Boolean);

const narrativeBlocks = (label, value, key, fieldName) => {
  const blocks = []; let plainRows = [];
  const flushPlain = () => {
    if (!plainRows.length) return;
    blocks.push({ key: `${key}-plain-${blocks.length}`, fieldLabel: blocks.length ? '' : label, rows: plainRows });
    plainRows = [];
  };
  splitSentences(fmt(value)).forEach(sentence => {
    const parsed = parseLabel(sentence);
    const source = parsed.labeled ? parsed.value : sentence;
    const commaItems = splitByComma(source);
    const shouldSplitComma = parsed.labeled || COMMA_STRING_FIELDS.includes(fieldName);
    const rows = shouldSplitComma && commaItems.length >= 2 ? commaItems : [source];
    if (parsed.labeled) {
      flushPlain();
      blocks.push({ key: `${key}-labeled-${blocks.length}`, fieldLabel: blocks.length ? '' : label, subLabel: parsed.label, rows });
    } else plainRows.push(...rows);
  });
  flushPlain();
  return blocks;
};
const dateBlock = (label, value, key) => isEmptyDeep(value) ? [] : [{ key, fieldLabel: label, rows: [formatDate(value)] }];
const arrayBlocks = (label, value, key) => {
  const rows = Array.isArray(value) ? value.filter(item => !isEmptyDeep(item)).map(fmt) : [];
  return rows.length ? [{ key, fieldLabel: label, rows }] : [];
};
const objectBlocks = (label, value, key) => {
  const blocks = [];
  const visit = (node, path, labels) => {
    if (isEmptyDeep(node)) return;
    if (Array.isArray(node)) {
      const items = node.filter(item => !isEmptyDeep(item));
      if (items.every(item => typeof item !== 'object')) blocks.push({ key: path, fieldLabel: blocks.length ? '' : label, subLabel: labels.join(' - '), rows: items.map(fmt) });
      else items.forEach((item, index) => visit(item, `${path}-${index}`, [...labels, `Item ${index + 1}`]));
      return;
    }
    if (typeof node === 'object') {
      Object.entries(node).forEach(([childKey, childValue]) => visit(childValue, `${path}-${childKey}`, [...labels, humanize(childKey)]));
      return;
    }
    const fieldPath = path.replace(/-/g, '.').replace(new RegExp(`^${key}\\.`), `${key}.`);
    if (typeof node === 'string' && isDatePath(fieldPath) && !isNaN(new Date(node).getTime())) {
      blocks.push({ key: path, fieldLabel: blocks.length ? '' : label, subLabel: labels.join(' - '), rows: [formatDate(node)] });
      return;
    }
    const sentences = typeof node === 'string' ? splitSentences(node) : [fmt(node)];
    sentences.forEach((sentence, sentenceIndex) => {
      const parsed = parseLabel(sentence);
      const source = parsed.labeled ? parsed.value : sentence;
      const commaItems = splitByComma(source);
      const rows = (parsed.labeled || COMMA_OBJECT_PATHS.includes(fieldPath)) && commaItems.length >= 2 ? commaItems : [source];
      blocks.push({ key: `${path}-${sentenceIndex}`, fieldLabel: blocks.length ? '' : label, subLabel: [...labels, ...(parsed.labeled ? [parsed.label] : [])].join(' - '), rows });
    });
  };
  visit(value, key, []);
  return blocks;
};
const artCycleBlocks = items => {
  return (Array.isArray(items) ? items : []).map((item, itemIndex) => {
    const pairs = Object.entries(item || {})
      .filter(([, value]) => !isEmptyDeep(value))
      .map(([field, value]) => ({
        label: humanize(field),
        rows: Array.isArray(value) ? value.filter(entry => !isEmptyDeep(entry)).map(fmt) : [fmt(value)]
      }))
      .filter(pair => pair.rows.length);
    return pairs.length ? { key: `art-${itemIndex}`, preLabel: `ART Cycle ${itemIndex + 1}`, pairs } : null;
  }).filter(Boolean);
};
const recommendationBlocks = items => {
  const groups = [];
  (Array.isArray(items) ? items : []).forEach(item => {
    const rec = typeof item === 'string' ? { recommendation: item, date: '' } : item;
    if (!rec?.recommendation) return;
    const dateKey = String(rec.date || '');
    const group = groups.find(entry => entry.dateKey === dateKey);
    if (group) group.rows.push(rec.recommendation);
    else groups.push({ dateKey, date: rec.date, rows: [rec.recommendation] });
  });
  const blocks = [];
  groups.forEach((group, groupIndex) => {
    const rows = group.rows.flatMap(row => { const parts = splitByComma(row); return parts.length >= 2 ? parts : [row]; });
    rows.forEach((row, rowIndex) => blocks.push({
      key: `recommendation-${groupIndex}-${rowIndex}`,
      fieldLabel: blocks.length ? '' : 'Recommendations',
      subLabel: rowIndex === 0 && group.date ? formatDate(group.date) : '',
      rows: [row]
    }));
  });
  return blocks;
};
const renderSection = (title, blocks, key) => {
  const usable = (blocks || []).filter(block => block && (block.fieldLabel || block.subLabel || block.rows?.length || block.pairs?.length));
  if (!usable.length) return null;
  return (
    <React.Fragment key={key}>
      {usable.map((block, index) => (
        <View key={block.key || `${key}-${index}`} style={styles.block} wrap={false}>
          {index === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {block.preLabel && <Text style={styles.subLabel}>{block.preLabel}</Text>}
          {(block.pairs || []).map((pair, pairIndex) => (
            <View key={`${block.key}-pair-${pairIndex}`}>
              <Text style={styles.fieldLabel}>{pair.label}</Text>
              {pair.rows.map((row, rowIndex) => <Text key={rowIndex} style={pair.rows.length > 1 ? styles.listItem : styles.fieldValue}>{pair.rows.length > 1 ? `${rowIndex + 1}. ${row}` : row}</Text>)}
            </View>
          ))}
          {block.fieldLabel && block.fieldLabel.trim().toLowerCase() !== title.trim().toLowerCase() && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
          {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
          {(block.rows || []).map((row, rowIndex) => <Text key={rowIndex} style={block.rows.length > 1 ? styles.listItem : styles.fieldValue}>{block.rows.length > 1 ? `${rowIndex + 1}. ${row}` : row}</Text>)}
        </View>
      ))}
    </React.Fragment>
  );
};
const unwrap = data => (Array.isArray(data) ? data : [data]).flatMap(record =>
  record?.reproductive_history
    ? (Array.isArray(record.reproductive_history) ? record.reproductive_history : [record.reproductive_history])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.reproductive_history ? (Array.isArray(record.documentData.reproductive_history) ? record.documentData.reproductive_history : [record.documentData.reproductive_history]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

export default function ReproductiveHistoryDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Reproductive History</Text></View>
        {!records.length && <Text style={styles.noDataText}>No reproductive history data available</Text>}
        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Reproductive History ${index + 1}`}</Text></View>
            {renderSection('History Information', [
              ...dateBlock('Date', record.date, 'date'),
              ...narrativeBlocks('Type', record.type, 'type', 'type'),
              ...narrativeBlocks('Provider', record.provider, 'provider', WHOLE_STRING_FIELDS[0]),
              ...narrativeBlocks('Facility', record.facility, 'facility', WHOLE_STRING_FIELDS[1])
            ], 'history')}
            {renderSection('Infertility', [
              ...narrativeBlocks('Infertility Diagnosis', record.infertilityDiagnosis, 'diagnosis', 'infertilityDiagnosis'),
              ...narrativeBlocks('Infertility Duration', record.infertilityDuration, 'duration', 'infertilityDuration')
            ], 'infertility')}
            {renderSection('ART Cycles', artCycleBlocks(record.artCycles), 'art-cycles')}
            {renderSection('PGT Testing', objectBlocks('PGT Testing', record.pgtTesting, 'pgtTesting'), 'pgt-testing')}
            {renderSection('Menstrual History', objectBlocks('Menstrual History', record.menstrualHistory, 'menstrualHistory'), 'menstrual-history')}
            {renderSection('Contraceptive History', arrayBlocks('Contraceptive History', record.contraceptiveHistory, 'contraception'), 'contraception')}
            {renderSection('Clinical Findings', [
              ...narrativeBlocks('Findings', record.findings, 'findings', 'findings'),
              ...narrativeBlocks('Assessment', record.assessment, 'assessment', 'assessment'),
              ...objectBlocks('Results', record.results, 'results'),
              ...objectBlocks('Additional Data', record.additionalData, 'additionalData'),
              ...narrativeBlocks('Notes', record.notes, 'notes', 'notes')
            ], 'clinical')}
            {renderSection('Plan and Recommendations', [
              ...narrativeBlocks('Plan', record.plan, 'plan', 'plan'),
              ...recommendationBlocks(record.recommendations)
            ], 'plan')}
            {renderSection('Status', narrativeBlocks('Status', record.status, 'status', 'status'), 'status')}
          </View>
        ))}
      </Page>
    </Document>
  );
}
