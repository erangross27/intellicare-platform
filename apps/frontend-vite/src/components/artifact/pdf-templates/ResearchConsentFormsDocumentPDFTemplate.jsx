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
  listItem: { fontSize: 14, paddingLeft: 10 },
  noDataText: { fontSize: 14, marginTop: 30 },
});

const SECTION_CONFIGS = [
  {
    title: 'Study Details',
    fields: [
      { key: 'studyTitle', label: 'Study Title', type: 'narrative' },
      { key: 'studyProtocolNumber', label: 'Study Protocol Number', type: 'narrative' },
      { key: 'principalInvestigatorName', label: 'Principal Investigator', type: 'narrative' },
      { key: 'irbApprovalNumber', label: 'IRB Approval Number', type: 'narrative' },
      { key: 'fdaInvestigationalNewDrugNumber', label: 'FDA IND Number', type: 'narrative' },
      { key: 'consentVersionDate', label: 'Consent Version Date', type: 'date' },
      { key: 'studyPhase', label: 'Study Phase', type: 'narrative' },
    ],
  },
  {
    title: 'Participation',
    fields: [
      { key: 'participantEligibilityCriteria', label: 'Participant Eligibility Criteria', type: 'array' },
      { key: 'interventionalProcedures', label: 'Interventional Procedures', type: 'array' },
    ],
  },
  {
    title: 'Drug & Design',
    fields: [
      { key: 'investigationalDrugName', label: 'Investigational Drug Name', type: 'narrative' },
      { key: 'placeboControlled', label: 'Placebo Controlled', type: 'scalar' },
      { key: 'randomizationMethod', label: 'Randomization Method', type: 'narrative' },
      { key: 'studyDurationWeeks', label: 'Study Duration (Weeks)', type: 'scalar' },
    ],
  },
  {
    title: 'Safety & Monitoring',
    fields: [
      { key: 'adverseEventReporting', label: 'Adverse Event Reporting', type: 'narrative' },
      { key: 'geneticTestingIncluded', label: 'Genetic Testing Included', type: 'scalar' },
      { key: 'radiationExposure', label: 'Radiation Exposure', type: 'narrative' },
      { key: 'contraceptiveRequirements', label: 'Contraceptive Requirements', type: 'narrative' },
    ],
  },
  {
    title: 'Compliance',
    fields: [
      { key: 'dataMonitoringCommittee', label: 'Data Monitoring Committee', type: 'scalar' },
      { key: 'hipaaAuthorizationIncluded', label: 'HIPAA Authorization Included', type: 'scalar' },
      { key: 'compensationAmount', label: 'Compensation Amount', type: 'scalar' },
    ],
  },
  {
    title: 'Endpoints & Rights',
    fields: [
      { key: 'primaryEndpoint', label: 'Primary Endpoint', type: 'narrative' },
      { key: 'withdrawalRights', label: 'Withdrawal Rights', type: 'narrative' },
      { key: 'pregnancyTesting', label: 'Pregnancy Testing', type: 'scalar' },
    ],
  },
];

const LABELED_NARRATIVE_FIELDS = ['studyTitle', 'randomizationMethod', 'adverseEventReporting', 'radiationExposure', 'contraceptiveRequirements', 'withdrawalRights'];
const COMMA_SPLIT_STRING_FIELDS = ['randomizationMethod', 'adverseEventReporting'];
const isEmptyDeep = value => value == null || value === '' || (Array.isArray(value) ? !value.some(item => !isEmptyDeep(item)) : typeof value === 'object' ? Object.values(value).every(isEmptyDeep) : false);
const fmt = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const formatDate = value => {
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime()) ? fmt(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return fmt(value); }
};
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"%<>~+=-]{1,120}?):\s+([\s\S]+)/);
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

const scalarBlocks = (label, value, key, formatter = fmt) => isEmptyDeep(value) ? [] : [{ key, fieldLabel: label, value: formatter(value) }];
const arrayBlocks = (label, value, key) => {
  const values = (Array.isArray(value) ? value : []).filter(item => !isEmptyDeep(item)).map(fmt);
  return values.length ? [{ key, fieldLabel: label, values }] : [];
};
const narrativeBlocks = (label, value, key) => {
  const blocks = []; let number = 1;
  splitSentences(fmt(value)).forEach((sentence, sentenceIndex) => {
    const parsed = LABELED_NARRATIVE_FIELDS.includes(key) ? parseLabel(sentence) : { value: sentence, labeled: false };
    const parts = COMMA_SPLIT_STRING_FIELDS.includes(key) ? splitByComma(parsed.value) : [parsed.value];
    parts.forEach((part, partIndex) => blocks.push({
      key: `${key}-${sentenceIndex}-${partIndex}`,
      fieldLabel: blocks.length === 0 ? label : '',
      subLabel: parsed.labeled && partIndex === 0 ? parsed.label : '',
      value: part,
      rowNumber: number++,
    }));
  });
  return blocks;
};
const sectionBlocks = (record, config) => config.fields.flatMap(field => {
  if (field.type === 'array') return arrayBlocks(field.label, record[field.key], field.key);
  if (field.type === 'narrative') return narrativeBlocks(field.label, record[field.key], field.key);
  if (field.type === 'date') return scalarBlocks(field.label, record[field.key], field.key, formatDate);
  return scalarBlocks(field.label, record[field.key], field.key);
});

const renderSection = (title, blocks, key) => {
  if (!blocks.length) return null;
  return (
    <React.Fragment key={key}>
      {blocks.map((block, index) => (
        <View key={block.key} style={styles.block} wrap={false}>
          {index === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
          {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
          {block.values
            ? block.values.map((value, valueIndex) => <Text key={`${block.key}-${valueIndex}`} style={styles.listItem}>{`${valueIndex + 1}. ${value}`}</Text>)
            : <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? `${block.rowNumber}. ${block.value}` : block.value}</Text>}
        </View>
      ))}
    </React.Fragment>
  );
};

const unwrap = data => (Array.isArray(data) ? data : [data]).flatMap(record =>
  record?.research_consent_forms
    ? (Array.isArray(record.research_consent_forms) ? record.research_consent_forms : [record.research_consent_forms])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.research_consent_forms ? (Array.isArray(record.documentData.research_consent_forms) ? record.documentData.research_consent_forms : [record.documentData.research_consent_forms]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

export default function ResearchConsentFormsDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Research Consent Forms</Text></View>
        {!records.length && <Text style={styles.noDataText}>No research consent forms data available</Text>}
        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Research Consent Forms ${index + 1}`}</Text></View>
            {SECTION_CONFIGS.map((config, sectionIndex) => renderSection(config.title, sectionBlocks(record, config), `section-${sectionIndex}`))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
