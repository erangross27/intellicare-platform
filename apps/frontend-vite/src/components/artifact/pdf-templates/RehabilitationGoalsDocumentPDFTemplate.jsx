/**
 * Canonical box-free PDF for rehabilitation_goals.
 * Mirrors RehabilitationGoalsDocument field order, grouping, and numbering.
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
  listItem: { fontSize: 14, lineHeight: 1.45, paddingLeft: 8, paddingBottom: 2 },
  noDataText: { fontSize: 14, color: '#4b5563', paddingTop: 24 },
});

const SECTION_CONFIGS = [
  {
    id: 'goal-overview',
    title: 'Goal Overview',
    fields: [
      { key: 'goalDescription', label: 'Goal Description' },
      { key: 'functionalCategory', label: 'Functional Category' },
      { key: 'priorityLevel', label: 'Priority Level' },
      { key: 'achievementStatus', label: 'Achievement Status' },
      { key: 'date', label: 'Date', kind: 'date' },
    ],
  },
  {
    id: 'timeline',
    title: 'Timeline & Schedule',
    fields: [
      { key: 'startDate', label: 'Start Date', kind: 'date' },
      { key: 'targetDate', label: 'Target Date', kind: 'date' },
      { key: 'duration', label: 'Duration' },
      { key: 'frequency', label: 'Frequency' },
    ],
  },
  {
    id: 'performance',
    title: 'Performance & Outcomes',
    fields: [
      { key: 'baselinePerformance', label: 'Baseline Performance' },
      { key: 'currentPerformance', label: 'Current Performance' },
      { key: 'targetPerformance', label: 'Target Performance' },
      { key: 'measurableOutcome', label: 'Measurable Outcome' },
      { key: 'percentComplete', label: 'Percent Complete', kind: 'number' },
    ],
  },
  {
    id: 'therapy',
    title: 'Therapy & Interventions',
    fields: [
      { key: 'therapyDiscipline', label: 'Therapy Discipline' },
      { key: 'responsibleTherapist', label: 'Responsible Therapist' },
      { key: 'interventionApproach', label: 'Intervention Approach', kind: 'array' },
    ],
  },
  {
    id: 'barriers-facilitators',
    title: 'Barriers & Facilitators',
    fields: [
      { key: 'barriers', label: 'Barriers', kind: 'array' },
      { key: 'facilitators', label: 'Facilitators', kind: 'array' },
      { key: 'equipmentRequired', label: 'Equipment Required', kind: 'array' },
    ],
  },
  {
    id: 'patient-involvement',
    title: 'Patient Involvement',
    fields: [
      { key: 'patientAgreement', label: 'Patient Agreement', kind: 'boolean' },
      { key: 'caregiverInvolvement', label: 'Caregiver Involvement' },
    ],
  },
  {
    id: 'discharge',
    title: 'Discharge Planning',
    fields: [
      { key: 'dischargeCriteria', label: 'Discharge Criteria' },
      { key: 'anticipatedDischargeDisposition', label: 'Anticipated Discharge Disposition' },
      { key: 'outcomeScale', label: 'Outcome Scale' },
      { key: 'modificationReason', label: 'Modification Reason' },
    ],
  },
];

const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

const safeString = (value) => String(value ?? '')
  .replace(/\u2265/g, '>=')
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

const CREDENTIAL_TOKEN = /^(?:MD|DO|RN|LPN|NP|PA|PhD|PharmD|FACC|FACP|FACS|FAAP|FACOG|MPH|MBA|BSN|MSN|DDS|DMD|DVM|DPT|Esq|Jr|Sr)\b/i;
const commaRowsForDisplay = (text) => {
  const rows = splitByComma(text);
  if (rows.length < 3 || rows.slice(1).some(row => CREDENTIAL_TOKEN.test(row.trim()))) return [text];
  return rows;
};

const parseNestedClinicalLabel = (text) => {
  const raw = safeString(text);
  const parenthetical = raw.match(/^(.+?)\s*\(([^():]+):\s*([^()]+)\)$/);
  let parsed;
  if (parenthetical) parsed = { isLabeled: true, label: `${parenthetical[1].trim()} — ${parenthetical[2].trim()}`, value: parenthetical[3].trim() };
  else parsed = parseLabel(raw);
  return {
    ...parsed,
    displayValue: parsed.isLabeled && /^[<>~]?\d+(?:\.\d+)?%?$/.test(parsed.value) ? `Score ${parsed.value}` : parsed.value,
  };
};

const pushGroup = (groups, group) => {
  if (!group.rows.length) return;
  if (!group.label && groups.length && !groups[groups.length - 1].label) groups[groups.length - 1].rows.push(...group.rows);
  else groups.push(group);
};

const appendClinicalRows = (groups, initialLabel, rows) => {
  let pending = { label: initialLabel, rows: [] };
  rows.forEach(row => {
    const clinical = parseNestedClinicalLabel(row);
    if (!clinical.isLabeled) { pending.rows.push(clinical.displayValue); return; }
    pushGroup(groups, pending);
    groups.push({ label: clinical.label, rows: [clinical.displayValue] });
    pending = { label: '', rows: [] };
  });
  pushGroup(groups, pending);
};

const buildStringGroups = (text) => {
  const groups = [];
  splitBySentence(text).forEach(sentence => {
    const parsed = parseLabel(sentence);
    const commaRows = commaRowsForDisplay(parsed.isLabeled ? parsed.value : sentence);
    const rows = commaRows
      .map(value => safeString(value).replace(/[;.]+$/, '').trim())
      .filter(Boolean);
    if (!rows.length) return;
    appendClinicalRows(groups, parsed.isLabeled ? parsed.label : '', rows);
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
    const groups = [];
    appendClinicalRows(groups, '', rows);
    return groups;
  }
  if (config.kind === 'boolean' || config.kind === 'number') return [{ label: '', rows: [formatValue(value)] }];
  return buildStringGroups(formatValue(value));
};

const FieldBlock = ({ config, sectionTitle, groups }) => {
  const rowCount = groups.reduce((count, group) => count + group.rows.length, 0);
  return (
    <View style={styles.fieldBlock} wrap={rowCount > 8 ? true : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      {!sameAsTitle(config.label, sectionTitle) && <Text style={styles.fieldLabel}>{config.label}</Text>}
      {groups.map((group, groupIndex) => (
        <View key={groupIndex}>
          {group.label && <Text style={styles.nestedLabel}>{group.label}</Text>}
          {group.rows.map((row, rowIndex) => (
            <Text key={rowIndex} style={styles.listItem}>{`${rowIndex + 1}. ${row}`}</Text>
          ))}
        </View>
      ))}
    </View>
  );
};

const unwrapRecords = (raw) => {
  const input = Array.isArray(raw) ? raw : [raw];
  return input.flatMap(item => {
    if (item?.rehabilitation_goals) return Array.isArray(item.rehabilitation_goals) ? item.rehabilitation_goals : [item.rehabilitation_goals];
    if (item?.documentData) {
      const nested = item.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.rehabilitation_goals) return Array.isArray(nested.rehabilitation_goals) ? nested.rehabilitation_goals : [nested.rehabilitation_goals];
      return [nested];
    }
    return [item];
  }).filter(item => item && typeof item === 'object');
};

const RehabilitationGoalsDocumentPDFTemplate = ({ document: docProp, data }) => {
  const raw = docProp || data;
  const records = raw ? unwrapRecords(raw) : [];
  if (!records.length) {
    return <Document><Page size="LETTER" style={styles.page}><Text style={styles.noDataText}>No rehabilitation goals data available</Text></Page></Document>;
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Rehabilitation Goals</Text>
        </View>
        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Rehabilitation Goal ${recordIndex + 1}`}</Text>
            </View>
            {SECTION_CONFIGS.map(section => {
              const fields = section.fields.map(config => ({ config, groups: fieldGroups(record, config) })).filter(field => field.groups.length);
              if (!fields.length) return null;
              return (
                <View key={section.id} style={styles.section}>
                  {fields.map((field, fieldIndex) => (
                    <FieldBlock key={field.config.key} config={field.config} groups={field.groups} sectionTitle={fieldIndex === 0 ? section.title : ''} />
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RehabilitationGoalsDocumentPDFTemplate;
