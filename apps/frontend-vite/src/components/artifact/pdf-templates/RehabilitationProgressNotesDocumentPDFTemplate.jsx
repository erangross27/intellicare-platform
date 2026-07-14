/**
 * Canonical box-free PDF for rehabilitation_progress_notes.
 * Mirrors RehabilitationProgressNotesDocument field order, grouping, and numbering.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.45, color: '#000000', backgroundColor: '#ffffff' },
  documentHeader: { paddingBottom: 18 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: {},
  recordHeader: { paddingBottom: 8 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: {},
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBlock: { paddingTop: 6, paddingBottom: 3 },
  atomicBlock: { paddingBottom: 2 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  nestedLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.45, paddingLeft: 8, paddingBottom: 2 },
  noDataText: { fontSize: 14, color: '#4b5563', paddingTop: 24 },
});

const SECTION_CONFIGS = [
  {
    id: 'assessment-scores',
    title: 'Assessment Scores',
    fields: [
      { key: 'functionalIndependenceMeasure', label: 'Functional Independence Measure (FIM)', kind: 'number' },
      { key: 'barthel', label: 'Barthel Index', kind: 'number' },
      { key: 'rankinScale', label: 'Modified Rankin Scale', kind: 'number' },
      { key: 'cognitiveAssessment', label: 'Cognitive Assessment', kind: 'number' },
      { key: 'berghBalance', label: 'Berg Balance Scale', kind: 'number' },
      { key: 'painScale', label: 'Pain Scale (0-10)', kind: 'number' },
    ],
  },
  {
    id: 'mobility-testing',
    title: 'Mobility Testing',
    fields: [
      { key: 'gaitSpeed', label: 'Gait Speed (m/s)', kind: 'number' },
      { key: 'sixMinuteWalkTest', label: 'Six-Minute Walk Test (m)', kind: 'number' },
      { key: 'timedUpAndGo', label: 'Timed Up and Go (seconds)', kind: 'number' },
      { key: 'functionalReach', label: 'Functional Reach (cm)', kind: 'number' },
      { key: 'ashworthScale', label: 'Modified Ashworth Scale', kind: 'text' },
    ],
  },
  {
    id: 'muscle-rom',
    title: 'Muscle & Range of Motion',
    fields: [
      { key: 'rangeOfMotion', label: 'Range of Motion', kind: 'array' },
      { key: 'muscleStrengthTesting', label: 'Muscle Strength Testing', kind: 'array' },
    ],
  },
  {
    id: 'therapy-progress',
    title: 'Therapy Progress',
    fields: [
      { key: 'swallowingAssessment', label: 'Swallowing Assessment', kind: 'text' },
      { key: 'speechTherapyProgress', label: 'Speech Therapy Progress', kind: 'text' },
      { key: 'therapyParticipation', label: 'Therapy Participation', kind: 'text' },
    ],
  },
  {
    id: 'goals-interventions',
    title: 'Goals & Interventions',
    fields: [
      { key: 'occupationalTherapyGoals', label: 'Occupational Therapy Goals', kind: 'array' },
      { key: 'physicalTherapyInterventions', label: 'Physical Therapy Interventions', kind: 'array' },
    ],
  },
  {
    id: 'devices-comorbidities',
    title: 'Devices & Comorbidities',
    fields: [
      { key: 'assistiveDevices', label: 'Assistive Devices', kind: 'array' },
      { key: 'comorbidityImpact', label: 'Comorbidity Impact', kind: 'array' },
    ],
  },
  {
    id: 'discharge',
    title: 'Discharge',
    fields: [
      { key: 'dischargeDisposition', label: 'Discharge Disposition', kind: 'text' },
      { key: 'rehabilitationPotential', label: 'Rehabilitation Potential', kind: 'text' },
      { key: 'medicationCompliance', label: 'Medication Compliance', kind: 'boolean' },
    ],
  },
];

const ZERO_SENTINEL_FIELDS = new Set(['functionalIndependenceMeasure', 'gaitSpeed', 'timedUpAndGo']);
const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();
const safeString = value => String(value ?? '').replace(/\u2265/g, '>=').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-');
const fieldHasVal = (field, value) => {
  if (ZERO_SENTINEL_FIELDS.has(field) && Number(value) === 0) return false;
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(item => item !== null && item !== undefined && String(item).trim() !== '');
  return typeof value === 'object' ? Object.keys(value).length > 0 : true;
};
const formatValue = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeString(value);
const displayFieldValue = (field, value) => field === 'ashworthScale' ? `Grade ${value}` : formatValue(value);

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
  const match = safeString(text).match(/^([A-Za-z0-9][A-Za-z0-9\s/&().#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: safeString(text) };
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

const appendRows = (groups, initialLabel, rows) => {
  const normalized = rows.map(row => safeString(row).replace(/[;.]+$/, '').trim()).filter(Boolean);
  if (!normalized.length) return;
  const previous = groups[groups.length - 1];
  if (!initialLabel && previous && !previous.label) previous.rows.push(...normalized);
  else groups.push({ label: initialLabel, rows: normalized });
};

const fieldGroups = (record, config) => {
  const value = record[config.key];
  if (!fieldHasVal(config.key, value)) return [];
  if (config.kind === 'number' || config.kind === 'boolean') return [{ label: '', rows: [formatValue(value)] }];
  if (config.kind === 'array') {
    const groups = [];
    (Array.isArray(value) ? value : [value]).filter(item => fieldHasVal('', item)).forEach(item => {
      const parsed = parseLabel(item);
      appendRows(groups, parsed.isLabeled ? parsed.label : '', [parsed.isLabeled ? parsed.value : item]);
    });
    return groups;
  }
  const groups = [];
  splitBySentence(displayFieldValue(config.key, value)).forEach(sentence => {
    const parsed = parseLabel(sentence);
    appendRows(groups, parsed.isLabeled ? parsed.label : '', splitByComma(parsed.isLabeled ? parsed.value : sentence));
  });
  return groups;
};

const FieldBlock = ({ config, sectionTitle, groups }) => (
  <View style={styles.fieldBlock}>
    {groups.map((group, groupIndex) => (
      <React.Fragment key={`${group.label}-${groupIndex}`}>
        <View style={styles.atomicBlock} wrap={false}>
          {groupIndex === 0 && sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
          {groupIndex === 0 && !sameAsTitle(config.label, sectionTitle) && <Text style={styles.fieldLabel}>{config.label}</Text>}
          {group.label && <Text style={styles.nestedLabel}>{group.label}</Text>}
          <Text style={styles.listItem}>{`1. ${group.rows[0]}`}</Text>
        </View>
        {group.rows.slice(1).map((row, rowIndex) => (
          <View key={rowIndex} style={styles.atomicBlock} wrap={false}>
            <Text style={styles.listItem}>{`${rowIndex + 2}. ${row}`}</Text>
          </View>
        ))}
      </React.Fragment>
    ))}
  </View>
);

const unwrapRecords = raw => {
  const input = Array.isArray(raw) ? raw : [raw];
  return input.flatMap(item => {
    if (item?.rehabilitation_progress_notes) return Array.isArray(item.rehabilitation_progress_notes) ? item.rehabilitation_progress_notes : [item.rehabilitation_progress_notes];
    if (item?.documentData) {
      const nested = item.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.rehabilitation_progress_notes) return Array.isArray(nested.rehabilitation_progress_notes) ? nested.rehabilitation_progress_notes : [nested.rehabilitation_progress_notes];
      return [nested];
    }
    return [item];
  }).filter(item => item && typeof item === 'object');
};

const RehabilitationProgressNotesDocumentPDFTemplate = ({ document: docProp, data }) => {
  const records = docProp || data ? unwrapRecords(docProp || data) : [];
  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><Text style={styles.noDataText}>No rehabilitation progress notes data available</Text></Page></Document>;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Rehabilitation Progress Notes</Text>
        </View>
        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Rehabilitation Progress Note ${recordIndex + 1}`}</Text>
            </View>
            {SECTION_CONFIGS.map(section => {
              const fields = section.fields.map(config => ({ config, groups: fieldGroups(record, config) })).filter(field => field.groups.length);
              if (!fields.length) return null;
              return (
                <View key={section.id} style={styles.section}>
                  {fields.map((field, fieldIndex) => <FieldBlock key={field.config.key} config={field.config} groups={field.groups} sectionTitle={fieldIndex === 0 ? section.title : ''} />)}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RehabilitationProgressNotesDocumentPDFTemplate;
