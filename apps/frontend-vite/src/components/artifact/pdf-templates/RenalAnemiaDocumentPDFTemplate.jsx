/**
 * RenalAnemiaDocumentPDFTemplate.jsx
 * Canonical black-and-white PDF for renal_anemia.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 36, paddingBottom: 24, fontFamily: 'Helvetica', color: '#000000', backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 18 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingBottom: 7, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { paddingBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 12, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  block: { marginBottom: 7 },
  compactBlock: { marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 5, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.35, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.35, marginBottom: 2, paddingLeft: 7 },
  noDataText: { fontSize: 14, textAlign: 'center', marginTop: 36 },
});

const KEY_OVERRIDES = { tsat: 'TSAT', tibc: 'TIBC', esa: 'ESA', hgb: 'Hgb', rbc: 'RBC', iv: 'IV' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const text = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const isScalar = value => value === null || typeof value !== 'object';
const isEmptyDeep = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean') return false;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isEmptyDeep);
  if (typeof value === 'object') return Object.values(value).every(isEmptyDeep);
  return false;
};
const fmtScalar = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(value); }
};
const toInputDate = (value) => {
  if (!value) return '';
  try { return new Date(value.$date || value).toISOString().slice(0, 10); } catch { return String(value); }
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&().#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: text };
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '(') { depth++; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char !== ',' || depth !== 0) { current += char; continue; }
    const before = current.trim(); const after = text.slice(index + 1); const afterTrimmed = after.trimStart();
    const nextWord = (afterTrimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(afterTrimmed)) || after.length === afterTrimmed.length || ['and', 'or', 'then'].includes(nextWord) || ['and', 'or'].includes(previousWord);
    if (protectedComma) current += char;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let current = '';
  const abbreviations = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g)$/i;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]; current += char;
    if ((char !== '.' && char !== ';') || !/\s/.test(text[index + 1] || '')) continue;
    const candidate = current.slice(0, -1).trim();
    const decimal = char === '.' && /\d$/.test(candidate) && /^\d/.test(text.slice(index + 1).trimStart());
    const genus = char === '.' && /(?:^|\s)[A-Z]$/.test(candidate);
    if (decimal || genus || abbreviations.test(candidate)) continue;
    parts.push(candidate); current = '';
  }
  const tail = current.trim().replace(/[.;]+$/, '');
  if (tail) parts.push(tail);
  return parts;
};

const narrativeBlocks = (fieldLabel, text, keyPrefix) => {
  const sentences = splitBySentence(String(text || ''));
  const blocks = []; let unlabeledRows = [];
  const flushUnlabeled = () => {
    if (!unlabeledRows.length) return;
    blocks.push({ key: `${keyPrefix}-plain-${blocks.length}`, fieldLabel: blocks.length === 0 ? fieldLabel : '', rows: unlabeledRows });
    unlabeledRows = [];
  };
  sentences.forEach(sentence => {
    const parsed = parseLabel(sentence);
    const source = parsed.isLabeled ? parsed.value : sentence;
    const commaParts = splitByComma(source);
    const rows = (parsed.isLabeled && commaParts.length >= 2) || (!parsed.isLabeled && commaParts.length >= 3) ? commaParts : [source];
    if (parsed.isLabeled) {
      flushUnlabeled();
      blocks.push({ key: `${keyPrefix}-labeled-${blocks.length}`, fieldLabel: blocks.length === 0 ? fieldLabel : '', subLabel: parsed.label, rows });
    } else unlabeledRows.push(...rows);
  });
  flushUnlabeled();
  if (blocks.length && !blocks.some(block => block.fieldLabel)) blocks[0].fieldLabel = fieldLabel;
  return blocks;
};

const scalarBlock = (fieldLabel, value, key) => isEmptyDeep(value) ? [] : [{ key, fieldLabel, rows: [fmtScalar(value)] }];
const objectBlocks = (value, keyPrefix) => {
  const blocks = [];
  const visit = (label, child, path) => {
    if (isEmptyDeep(child)) return;
    if (isScalar(child)) { blocks.push({ key: path, fieldLabel: label, rows: [fmtScalar(child)] }); return; }
    if (Array.isArray(child)) {
      const items = child.filter(item => !isEmptyDeep(item));
      if (items.every(isScalar)) blocks.push({ key: path, fieldLabel: label, rows: items.map(fmtScalar) });
      else items.forEach((item, index) => visit(`${label} ${index + 1}`, item, `${path}-${index}`));
      return;
    }
    Object.entries(child).filter(([, nested]) => !isEmptyDeep(nested)).forEach(([key, nested]) => visit(humanizeKey(key), nested, `${path}-${key}`));
  };
  Object.entries(value || {}).filter(([, child]) => !isEmptyDeep(child)).forEach(([key, child]) => visit(humanizeKey(key), child, `${keyPrefix}-${key}`));
  return blocks;
};
const transfusionBlocks = (items) => (items || []).flatMap((item, index) => {
  const fields = [
    ['Date', item?.date ? formatDate(item.date) : ''],
    ['Units', item?.units],
    ['Type', item?.type],
    ['Reason', item?.reason],
  ].filter(([, value]) => !isEmptyDeep(value));
  return fields.map(([fieldLabel, value], fieldIndex) => ({
    key: `transfusion-${index}-${fieldLabel}`,
    subLabel: fieldIndex === 0 ? `Transfusion ${index + 1}` : '',
    fieldLabel,
    rows: [fmtScalar(value)],
  }));
});
const recommendationBlocks = (recommendations) => {
  const groups = [];
  (recommendations || []).forEach(item => {
    if (!item?.recommendation) return;
    const key = toInputDate(item.date) || String(item.date || '') || 'no-date';
    const group = groups.find(entry => entry.key === key);
    if (group) group.rows.push(item.recommendation);
    else groups.push({ key, date: item.date, rows: [item.recommendation] });
  });
  return groups.map((group, index) => ({ key: `recommendations-${group.key}`, fieldLabel: index === 0 ? 'Recommendations' : '', subLabel: group.date ? formatDate(group.date) : '', rows: group.rows, compact: true }));
};

const renderSection = (title, blocks, key) => {
  const usable = (blocks || []).filter(block => block && (block.fieldLabel || block.subLabel || block.rows?.length));
  if (!usable.length) return null;
  return (
    <React.Fragment key={key}>
      {usable.map((block, index) => (
        <View key={block.key || `${key}-${index}`} style={[styles.block, block.compact && styles.compactBlock]} wrap={false}>
          {index === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
          {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
          {(block.rows || []).map((row, rowIndex) => <Text key={rowIndex} style={block.rows.length > 1 ? styles.listItem : styles.fieldValue}>{block.rows.length > 1 ? `${rowIndex + 1}. ${row}` : row}</Text>)}
        </View>
      ))}
    </React.Fragment>
  );
};

const unwrapRecords = (data) => {
  if (!data) return [];
  const input = Array.isArray(data) ? data : [data];
  return input.flatMap(record => {
    if (record?.renal_anemia) return Array.isArray(record.renal_anemia) ? record.renal_anemia : [record.renal_anemia];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.renal_anemia) return Array.isArray(nested.renal_anemia) ? nested.renal_anemia : [nested.renal_anemia];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const RenalAnemiaDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => unwrapRecords(data), [data]);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Renal Anemia</Text></View>
        {!records.length && <Text style={styles.noDataText}>No data available</Text>}
        {records.map((record, recordIndex) => {
          const general = [
            ...scalarBlock('Date', formatDate(record.date), `general-date-${recordIndex}`),
            ...narrativeBlocks('Type', record.type, `general-type-${recordIndex}`),
            ...narrativeBlocks('Provider', record.provider, `general-provider-${recordIndex}`),
            ...narrativeBlocks('Facility', record.facility, `general-facility-${recordIndex}`),
            ...narrativeBlocks('Status', record.status, `general-status-${recordIndex}`),
          ];
          const hemoglobin = [
            ...narrativeBlocks('Hemoglobin', record.hemoglobin, `hemoglobin-${recordIndex}`),
            ...narrativeBlocks('Hemoglobin Target', record.hemoglobinTarget, `target-${recordIndex}`),
          ];
          const ironStudies = objectBlocks(record.ironStudies, `iron-studies-${recordIndex}`);
          const esaTherapy = [
            ...narrativeBlocks('Agent', record.esaTherapy?.agent, `esa-agent-${recordIndex}`),
            ...narrativeBlocks('Dose', record.esaTherapy?.dose, `esa-dose-${recordIndex}`),
            ...narrativeBlocks('Frequency', record.esaTherapy?.frequency, `esa-frequency-${recordIndex}`),
            ...narrativeBlocks('Response', record.esaTherapy?.response, `esa-response-${recordIndex}`),
          ];
          const ironTherapy = objectBlocks(record.ironTherapy, `iron-therapy-${recordIndex}`);
          return (
            <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
              <View wrap={false}><Text style={styles.recordTitle}>{`Renal Anemia ${recordIndex + 1}`}</Text></View>
              {renderSection('Record Information', general, `general-${recordIndex}`)}
              {renderSection('Hemoglobin Status', hemoglobin, `hemoglobin-status-${recordIndex}`)}
              {renderSection('Iron Studies', ironStudies, `iron-studies-${recordIndex}`)}
              {renderSection('ESA Therapy', esaTherapy, `esa-therapy-${recordIndex}`)}
              {renderSection('Iron Therapy', ironTherapy, `iron-therapy-${recordIndex}`)}
              {renderSection('Transfusion History', transfusionBlocks(record.transfusionHistory), `transfusion-${recordIndex}`)}
              {renderSection('Results', objectBlocks(record.results, `results-${recordIndex}`), `results-${recordIndex}`)}
              {renderSection('Findings', narrativeBlocks('', record.findings, `findings-only-${recordIndex}`), `findings-${recordIndex}`)}
              {renderSection('Assessment', narrativeBlocks('', record.assessment, `assessment-only-${recordIndex}`), `assessment-${recordIndex}`)}
              {renderSection('Plan', narrativeBlocks('', record.plan, `plan-only-${recordIndex}`), `plan-${recordIndex}`)}
              {renderSection('Recommendations', recommendationBlocks(record.recommendations), `recommendations-${recordIndex}`)}
              {renderSection('Notes', narrativeBlocks('', record.notes, `notes-${recordIndex}`), `notes-${recordIndex}`)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default RenalAnemiaDocumentPDFTemplate;
