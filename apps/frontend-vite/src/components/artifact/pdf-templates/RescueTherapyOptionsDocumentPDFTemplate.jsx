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
  noDataText: { fontSize: 14, marginTop: 30 }
});

const SECTION_CONFIGS = [
  {
    title: 'Therapy Indication & Response',
    fields: [
      { key: 'rescueTherapyIndication', label: 'Rescue Therapy Indication', type: 'narrative' },
      { key: 'rescueTherapyResponse', label: 'Rescue Therapy Response', type: 'narrative' },
      { key: 'rescueTherapyDuration', label: 'Rescue Therapy Duration', type: 'scalar' }
    ]
  },
  {
    title: 'Scoring & Assessment',
    fields: [
      { key: 'apacheIIScore', label: 'APACHE II Score', type: 'scalar' },
      { key: 'sofaScore', label: 'SOFA Score', type: 'scalar' },
      { key: 'glasgowComaScale', label: 'Glasgow Coma Scale', type: 'scalar' }
    ]
  },
  {
    title: 'Cardiovascular Support',
    fields: [
      { key: 'emergentRevascularizationType', label: 'Emergent Revascularization Type', type: 'narrative' },
      { key: 'thrombolyticAgent', label: 'Thrombolytic Agent', type: 'narrative' },
      { key: 'doorToBalloonTime', label: 'Door-to-Balloon Time', type: 'scalar' },
      { key: 'ecmoConfiguration', label: 'ECMO Configuration', type: 'narrative' },
      { key: 'iabpInsertionSite', label: 'IABP Insertion Site', type: 'narrative' },
      { key: 'vasopressorRequirement', label: 'Vasopressor Requirement', type: 'array' }
    ]
  },
  {
    title: 'Renal & Metabolic',
    fields: [
      { key: 'creatinineLevel', label: 'Creatinine Level', type: 'scalar' },
      { key: 'lactateLevel', label: 'Lactate Level', type: 'scalar' },
      { key: 'emergentDialysisModality', label: 'Emergent Dialysis Modality', type: 'narrative' }
    ]
  },
  {
    title: 'Respiratory Support',
    fields: [
      { key: 'airwayManagementType', label: 'Airway Management Type', type: 'narrative' },
      { key: 'mechanicalVentilationMode', label: 'Mechanical Ventilation Mode', type: 'narrative' },
      { key: 'peepLevel', label: 'PEEP Level', type: 'scalar' },
      { key: 'fio2Requirement', label: 'FiO2 Requirement', type: 'scalar' }
    ]
  },
  {
    title: 'Surgical & Hematologic',
    fields: [
      { key: 'emergentSurgicalProcedure', label: 'Emergent Surgical Procedure', type: 'narrative' },
      { key: 'bloodProductsAdministered', label: 'Blood Products Administered', type: 'array' },
      { key: 'coagulationStatus', label: 'Coagulation Status', type: 'narrative' },
      { key: 'complicationsDuringTherapy', label: 'Complications During Therapy', type: 'array' }
    ]
  }
];

const isEmptyDeep = value => value == null || value === '' || (Array.isArray(value) ? !value.some(item => !isEmptyDeep(item)) : typeof value === 'object' ? Object.values(value).every(isEmptyDeep) : false);
const fmt = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
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

const scalarBlocks = (label, value, key) => isEmptyDeep(value) ? [] : [{ key, fieldLabel: label, value: fmt(value) }];
const arrayBlocks = (label, value, key) => (Array.isArray(value) ? value : [])
  .filter(item => !isEmptyDeep(item))
  .map((item, index) => ({ key: `${key}-${index}`, fieldLabel: index === 0 ? label : '', value: fmt(item), rowNumber: index + 1 }));
const narrativeBlocks = (label, value, key) => {
  const blocks = []; let number = 1;
  splitSentences(fmt(value)).forEach((sentence, sentenceIndex) => {
    const parsed = parseLabel(sentence);
    const parts = parsed.labeled ? splitByComma(parsed.value) : [sentence];
    parts.forEach((part, partIndex) => blocks.push({
      key: `${key}-${sentenceIndex}-${partIndex}`,
      fieldLabel: blocks.length === 0 ? label : '',
      subLabel: parsed.labeled ? parsed.label : '',
      value: part,
      rowNumber: number++
    }));
  });
  return blocks;
};
const sectionBlocks = (record, config) => config.fields.flatMap(field => {
  if (field.type === 'array') return arrayBlocks(field.label, record[field.key], field.key);
  if (field.type === 'narrative') return narrativeBlocks(field.label, record[field.key], field.key);
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
          <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? `${block.rowNumber}. ${block.value}` : block.value}</Text>
        </View>
      ))}
    </React.Fragment>
  );
};

const unwrap = data => (Array.isArray(data) ? data : [data]).flatMap(record =>
  record?.rescue_therapy_options
    ? (Array.isArray(record.rescue_therapy_options) ? record.rescue_therapy_options : [record.rescue_therapy_options])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.rescue_therapy_options ? (Array.isArray(record.documentData.rescue_therapy_options) ? record.documentData.rescue_therapy_options : [record.documentData.rescue_therapy_options]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

export default function RescueTherapyOptionsDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Rescue Therapy Options</Text></View>
        {!records.length && <Text style={styles.noDataText}>No rescue therapy options data available</Text>}
        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Rescue Therapy Options ${index + 1}`}</Text></View>
            {SECTION_CONFIGS.map((config, sectionIndex) => renderSection(config.title, sectionBlocks(record, config), `section-${sectionIndex}`))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
