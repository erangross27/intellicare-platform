/**
 * Canonical box-free PDF for surgical_oncology.
 * Mirrors SurgicalOncologyDocument JSX field order, grouping, and numbering.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.45, color: '#000000', backgroundColor: '#ffffff' },
  pageBody: { flexGrow: 1, minHeight: '100%', padding: 40, backgroundColor: '#ffffff' },
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
  nestedLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.45, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#4b5563', paddingTop: 24 },
});

const SECTION_CONFIGS = [
  {
    id: 'procedure-info',
    title: 'Procedure Information',
    fields: ['procedureType', 'dateOfSurgery', 'surgeon', 'provider', 'facility'],
  },
  {
    id: 'pathology-findings',
    title: 'Pathology Findings',
    fields: [
      'pathologyFindings.tumorSize',
      'pathologyFindings.margins',
      'pathologyFindings.lymphNodesExamined',
      'pathologyFindings.lymphNodesPositive',
      'pathologyFindings.extrandalExtension',
      'pathologyFindings.lymphovascularInvasion',
      'pathologyFindings.perineuralInvasion',
    ],
  },
  { id: 'reconstruction', title: 'Reconstruction', fields: [] },
  { id: 'findings', title: 'Findings', fields: ['findings'] },
  { id: 'results', title: 'Results', fields: [] },
  { id: 'assessment', title: 'Assessment', fields: ['assessment'] },
  { id: 'complications', title: 'Complications', fields: [] },
  { id: 'plan', title: 'Plan', fields: ['plan'], breakBefore: true },
  { id: 'recommendations', title: 'Recommendations', fields: [] },
  { id: 'notes', title: 'Notes', fields: ['notes'] },
];

const FIELD_LABELS = {
  procedureType: 'Procedure Type',
  dateOfSurgery: 'Date of Surgery',
  surgeon: 'Surgeon',
  provider: 'Provider',
  facility: 'Facility',
  'pathologyFindings.tumorSize': 'Tumor Size',
  'pathologyFindings.margins': 'Margins',
  'pathologyFindings.lymphNodesExamined': 'Lymph Nodes Examined',
  'pathologyFindings.lymphNodesPositive': 'Lymph Nodes Positive',
  'pathologyFindings.extrandalExtension': 'Extranodal Extension',
  'pathologyFindings.lymphovascularInvasion': 'Lymphovascular Invasion',
  'pathologyFindings.perineuralInvasion': 'Perineural Invasion',
  reconstruction: 'Reconstruction',
  findings: 'Findings',
  results: 'Results',
  assessment: 'Assessment',
  complications: 'Complications',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};
const COMMA_ARRAY_FIELDS = new Set(['pathologyFindings.lymphNodesExamined', 'plan']);

const humanizeKey = (key) => String(key || '')
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, character => character.toUpperCase());
const getPathValue = (record, path) => String(path).split('.').reduce((value, part) => value?.[part], record);
const flattenLeafPaths = (value, prefix) => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = `${prefix}.${key}`;
    if (child !== null && typeof child === 'object') return flattenLeafPaths(child, path);
    return child === '' || child === null || child === undefined ? [] : [path];
  });
};
const sectionFields = (record, section) => {
  if (section.id === 'reconstruction' || section.id === 'results') return flattenLeafPaths(record?.[section.id], section.id);
  if (section.id === 'complications') return Array.isArray(record?.complications)
    ? record.complications.map((_, index) => `complications.${index}`)
    : [];
  if (section.id === 'recommendations') return Array.isArray(record?.recommendations)
    ? record.recommendations.flatMap((recommendation, index) => [
      recommendation?.recommendation ? `recommendations.${index}.recommendation` : null,
      recommendation?.date ? `recommendations.${index}.date` : null,
    ].filter(Boolean))
    : [];
  return section.fields;
};
const fieldLabel = (path) => {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  const parts = String(path).split('.');
  if (parts[0] === 'complications') return 'Complications';
  if (parts[0] === 'recommendations') {
    const itemNumber = Number(parts[1]) + 1;
    return parts[2] === 'date' ? `Recommendation ${itemNumber} Date` : `Recommendation ${itemNumber}`;
  }
  return humanizeKey(parts[parts.length - 1]);
};
const isDateField = path => path === 'dateOfSurgery' || /^recommendations\.\d+\.date$/.test(path);

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
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'object' ? Object.keys(value).length > 0 : true;
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
  const delimiterWithWhitespace = /[.;]\s/;
  const result = [];
  let current = '';
  let parenthesisDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(') parenthesisDepth += 1;
    else if (character === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    const isDelimiter = delimiterWithWhitespace.test(`${character}${text[index + 1] || ''}`) && parenthesisDepth === 0;
    const isProtectedTitle = character === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/.test(current);
    if (isDelimiter && !isProtectedTitle) {
      if (current.trim()) result.push(current.trim());
      current = '';
      while (/\s/.test(text[index + 1] || '')) index += 1;
    } else current += character;
  }
  const tail = current.replace(/[.;]+$/, '').trim();
  if (tail) result.push(tail);
  return result;
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
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

const buildStringGroups = (text, fieldName = '') => {
  const groups = [];
  splitBySentence(text).forEach(sentence => {
    const parsed = parseLabel(sentence);
    const splitCommas = parsed.isLabeled || COMMA_ARRAY_FIELDS.has(fieldName);
    const source = parsed.isLabeled ? parsed.value : sentence;
    const rows = (splitCommas ? splitByComma(source) : [source])
      .map(value => safeString(value).replace(/[;.]+$/, '').trim())
      .filter(Boolean);
    if (!rows.length) return;
    if (!parsed.isLabeled && groups.length && !groups[groups.length - 1].label) groups[groups.length - 1].rows.push(...rows);
    else groups.push({ label: parsed.isLabeled ? parsed.label : '', rows });
  });
  return groups;
};

const fieldGroups = (record, config) => {
  const value = getPathValue(record, config.key);
  if (!hasVal(value)) return [];
  if (config.kind === 'date') {
    const formatted = formatDate(value);
    return formatted ? [{ label: '', rows: [formatted] }] : [];
  }
  if (typeof value === 'boolean') return [{ label: '', rows: [value ? 'Yes' : 'No'] }];
  return buildStringGroups(safeString(value), config.key);
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
  const configs = sectionFields(record, section).map(key => ({
    key,
    label: fieldLabel(key),
    kind: isDateField(key) ? 'date' : 'string',
  }));
  const nodes = configs.flatMap(config => renderFieldNodes(record, config, section.title));
  if (!nodes.length) return null;
  return (
    <View key={section.id} style={styles.section} break={section.breakBefore}>
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
    if (record?.surgical_oncology) return Array.isArray(record.surgical_oncology) ? record.surgical_oncology : [record.surgical_oncology];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.surgical_oncology) return Array.isArray(nested.surgical_oncology) ? nested.surgical_oncology : [nested.surgical_oncology];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const SurgicalOncologyDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  return (
    <Document>
      {records.length ? records.map((record, index) => (
        <Page size="A4" style={styles.page} key={record._id?.$oid || record._id || index}>
          <View style={styles.pageBody}>
            {index === 0 ? (
              <View style={styles.documentHeader} wrap={false}>
                <Text style={styles.documentTitle}>Surgical Oncology</Text>
              </View>
            ) : null}
            <View style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>Surgical Oncology {index + 1}</Text>
              </View>
              {SECTION_CONFIGS.map(section => renderSection(record, section))}
            </View>
          </View>
        </Page>
      )) : (
        <Page size="A4" style={styles.page}>
          <View style={styles.pageBody}>
            <View style={styles.documentHeader} wrap={false}>
              <Text style={styles.documentTitle}>Surgical Oncology</Text>
            </View>
            <Text style={styles.noDataText}>No surgical oncology records available.</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};

export default SurgicalOncologyDocumentPDFTemplate;
