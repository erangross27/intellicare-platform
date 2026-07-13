/**
 * Canonical box-free PDF for regional_anesthesia_records.
 * Mirrors RegionalAnesthesiaDocument field order, grouping, and numbering.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.45, color: '#000000', backgroundColor: '#ffffff' },
  documentHeader: { paddingBottom: 18 },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  recordContainer: { paddingBottom: 18 },
  recordHeader: { paddingBottom: 8 },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  section: { paddingBottom: 14 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  fieldBlock: { paddingTop: 6, paddingBottom: 3 },
  rowBlock: { paddingBottom: 3 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 2,
    marginBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
  },
  nestedLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 2,
    marginBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
  },
  listItem: { fontSize: 14, lineHeight: 1.45, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#4b5563', paddingTop: 24 },
});

const SECTION_CONFIGS = [
  {
    id: 'block-location',
    title: 'Block Type & Location',
    fields: [
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'blockType', label: 'Block Type' },
      { key: 'anatomicalLocation', label: 'Anatomical Location' },
      { key: 'approachTechnique', label: 'Approach / Technique' },
    ],
  },
  {
    id: 'equipment',
    title: 'Equipment',
    fields: [{ key: 'needleGaugeSize', label: 'Needle Gauge / Size' }],
  },
  {
    id: 'local-anesthetic',
    title: 'Local Anesthetic',
    fields: [
      { key: 'localAnestheticAgent', label: 'Local Anesthetic Agent' },
      { key: 'localAnestheticConcentration', label: 'Concentration' },
      { key: 'totalVolume', label: 'Total Volume (mL)', kind: 'number' },
      { key: 'totalDoseMg', label: 'Total Dose (mg)', kind: 'number' },
    ],
  },
  {
    id: 'procedure-details',
    title: 'Procedure Details',
    fields: [
      { key: 'numberOfAttempts', label: 'Number of Attempts', kind: 'number' },
      { key: 'aspirationResult', label: 'Aspiration Result' },
      { key: 'additiveAgents', label: 'Additive Agents', kind: 'array' },
    ],
  },
  {
    id: 'block-assessment',
    title: 'Block Assessment',
    fields: [
      { key: 'sensoryBlockLevel', label: 'Sensory Block Level' },
      { key: 'motorBlockLevel', label: 'Motor Block Level' },
      { key: 'onsetTime', label: 'Onset Time (minutes)', kind: 'number' },
      { key: 'blockAdequacy', label: 'Block Adequacy' },
      { key: 'supplementalAnesthesia', label: 'Supplemental Anesthesia' },
    ],
  },
  {
    id: 'catheter-test',
    title: 'Catheter & Test Dose',
    fields: [
      { key: 'catheterPlaced', label: 'Catheter Placed', kind: 'boolean' },
      { key: 'catheterDepth', label: 'Catheter Depth (cm)', kind: 'number' },
      { key: 'testDoseGiven', label: 'Test Dose Given', kind: 'boolean' },
      { key: 'testDoseResponse', label: 'Test Dose Response' },
    ],
  },
  {
    id: 'patient-provider',
    title: 'Patient, Provider & Vitals',
    fields: [
      { key: 'patientPosition', label: 'Patient Position' },
      { key: 'sedationLevel', label: 'Sedation Level' },
      { key: 'performingAnesthesiologist', label: 'Performing Anesthesiologist' },
      { key: 'complicationsDuringProcedure', label: 'Complications During Procedure', kind: 'array' },
      { key: 'postBlockVitalSigns', label: 'Post-Block Vital Signs' },
    ],
  },
];

const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

const safeString = (value) => String(value ?? '')
  .replace(/\u00d7/g, 'x')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2013\u2014]/g, '-');

const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  return typeof value === 'object' ? Object.keys(value).length > 0 : true;
};

const formatValue = (value) => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return safeString(value);
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 1971) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const rows = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(') depth += 1;
    else if (character === ')') depth = Math.max(0, depth - 1);
    const candidate = depth === 0 && (character === ';' || character === '.');
    const protectedTitle = character === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g)$/.test(current);
    const decimal = character === '.' && /\d$/.test(current) && /^\d/.test(text[index + 1] || '');
    const boundary = candidate && !protectedTitle && !decimal && (!text[index + 1] || /\s/.test(text[index + 1]));
    if (!boundary) { current += character; continue; }
    if (current.trim()) rows.push(current.trim());
    current = '';
    while (/\s/.test(text[index + 1] || '')) index += 1;
  }
  if (current.trim()) rows.push(current.trim());
  return rows;
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&().#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/);
  if (!match) return { isLabeled: false, label: '', value: text };
  return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(') { depth += 1; current += character; continue; }
    if (character === ')') { depth = Math.max(0, depth - 1); current += character; continue; }
    if (character !== ',' || depth !== 0) { current += character; continue; }
    const before = current.trim();
    const after = text.slice(index + 1);
    const afterTrimmed = after.trimStart();
    const nextWord = (afterTrimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
    const numericThousands = /\d$/.test(before) && /^\d{3}\b/.test(afterTrimmed);
    const noFollowingSpace = after.length === afterTrimmed.length;
    const linkedByConjunction = ['and', 'or'].includes(nextWord) || ['and', 'or'].includes(previousWord);
    if (numericThousands || noFollowingSpace || linkedByConjunction) current += character;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const buildStringGroups = (text) => {
  const groups = [];
  splitBySentence(text).forEach(sentence => {
    const parsed = parseLabel(sentence);
    const commaRows = parsed.isLabeled ? splitByComma(parsed.value) : [sentence];
    const rows = (parsed.isLabeled && commaRows.length < 3 ? [parsed.value] : commaRows)
      .map(value => safeString(value).replace(/[;.]+$/, '').trim())
      .filter(Boolean);
    if (!rows.length) return;
    if (!parsed.isLabeled && groups.length && !groups[groups.length - 1].label) groups[groups.length - 1].rows.push(...rows);
    else groups.push({ label: parsed.isLabeled ? parsed.label : '', rows });
  });
  return groups;
};

const fieldGroups = (record, config) => {
  const value = record[config.key];
  if (!hasVal(value)) return [];
  if (config.kind === 'date') {
    const formatted = formatDate(value);
    return formatted ? [{ label: '', rows: [formatted] }] : [];
  }
  if (config.kind === 'array') {
    const rows = (Array.isArray(value) ? value : [value]).filter(hasVal).map(formatValue);
    return rows.length ? [{ label: '', rows }] : [];
  }
  if (config.kind === 'number' || config.kind === 'boolean') return [{ label: '', rows: [formatValue(value)] }];
  return buildStringGroups(formatValue(value));
};

const renderFieldNodes = (record, config, sectionTitle) => {
  const groups = fieldGroups(record, config);
  if (!groups.length) return [];
  const nodes = [];
  let firstFieldRow = true;
  groups.forEach((group, groupIndex) => {
    group.rows.forEach((row, rowIndex) => {
      const firstGroupRow = rowIndex === 0;
      nodes.push(
        <View key={`${config.key}-${groupIndex}-${rowIndex}`} style={firstFieldRow ? styles.fieldBlock : styles.rowBlock} wrap={false}>
          {firstFieldRow && !sameAsTitle(config.label, sectionTitle) ? <Text style={styles.fieldLabel}>{config.label}</Text> : null}
          {firstGroupRow && group.label ? <Text style={styles.nestedLabel}>{safeString(group.label)}</Text> : null}
          <Text style={styles.listItem}>{rowIndex + 1}. {safeString(row)}</Text>
        </View>,
      );
      firstFieldRow = false;
    });
  });
  return nodes;
};

const renderSection = (record, section) => {
  const nodes = section.fields.flatMap(config => renderFieldNodes(record, config, section.title));
  if (!nodes.length) return null;
  return (
    <View key={section.id} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {React.cloneElement(nodes[0], { key: `${section.id}-first` })}
      </View>
      {nodes.slice(1).map((node, index) => React.cloneElement(node, { key: `${section.id}-node-${index + 1}` }))}
    </View>
  );
};

const unwrapRecords = (data) => {
  if (!data) return [];
  const input = Array.isArray(data) ? data : [data];
  return input.flatMap(record => {
    if (record?.regional_anesthesia_records) return Array.isArray(record.regional_anesthesia_records) ? record.regional_anesthesia_records : [record.regional_anesthesia_records];
    if (record?.regional_anesthesia) return Array.isArray(record.regional_anesthesia) ? record.regional_anesthesia : [record.regional_anesthesia];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.regional_anesthesia_records) return Array.isArray(nested.regional_anesthesia_records) ? nested.regional_anesthesia_records : [nested.regional_anesthesia_records];
      if (nested?.regional_anesthesia) return Array.isArray(nested.regional_anesthesia) ? nested.regional_anesthesia : [nested.regional_anesthesia];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const RegionalAnesthesiaDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}>
          <Text style={styles.documentTitle}>Regional Anesthesia Records</Text>
        </View>
        {!records.length ? <Text style={styles.noDataText}>No regional anesthesia records available.</Text> : null}
        {records.map((record, index) => (
          <View key={record._id?.$oid || record._id || index} style={styles.recordContainer} break={index > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Regional Anesthesia Record {index + 1}</Text>
            </View>
            {SECTION_CONFIGS.map(section => renderSection(record, section))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RegionalAnesthesiaDocumentPDFTemplate;
