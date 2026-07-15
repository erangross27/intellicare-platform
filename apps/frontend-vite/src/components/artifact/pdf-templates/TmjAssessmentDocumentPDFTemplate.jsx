/**
 * TmjAssessmentDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free — TMJ assessment
 * Collection: tmj_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 6, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_TITLES = {
  rom: 'Range of Motion',
  'pain-functional': 'Pain and Functional Assessment',
  'joint-sounds': 'Joint Sounds',
  'muscle-palpation': 'Muscle Palpation',
  'capsular-joint': 'Capsular and Joint Assessment',
  'disc-assessment': 'Disc Assessment',
  'dc-tmd-diagnosis': 'DC/TMD Diagnosis',
  occlusion: 'Occlusion',
  'condylar-morphology': 'Condylar Morphology',
};

const FIELD_LABELS = {
  maximalIncisorOpening: 'Maximal Opening',
  assistedMouthOpening: 'Assisted Opening',
  lateralExcursionRight: 'Lateral Excursion (Right)',
  lateralExcursionLeft: 'Lateral Excursion (Left)',
  protrusiveMovement: 'Protrusive Movement',
  deviationOnOpening: 'Deviation on Opening',
  jawPainIntensity: 'Pain Intensity',
  jawFunctionalLimitationScale: 'Jaw Functional Limitation Scale',
  gcps_chronicPainGrade: 'Chronic Pain Grade (GCPS)',
  bruxismPresence: 'Bruxism',
  jointSoundsRight: 'Right',
  jointSoundsLeft: 'Left',
  masseterPalpationTenderness: 'Masseter',
  temporalisPalpationTenderness: 'Temporalis',
  lateralPterygoidPalpation: 'Lateral Pterygoid',
  medialPterygoidPalpation: 'Medial Pterygoid',
  capsularTenderness: 'Capsular Tenderness',
  discDisplacementClassification: 'Disc Displacement Classification',
  mriDiscPosition: 'MRI Disc Position',
  effusionPresence: 'Effusion',
  dc_tmdDiagnosis: 'DC/TMD Diagnosis',
  occlusalClassification: 'Occlusal Classification',
  overjetMeasurement: 'Overjet',
  overbiteMeasurement: 'Overbite',
  condylarMorphology: 'Condylar Morphology',
};

const SECTION_FIELDS = {
  rom: ['maximalIncisorOpening', 'assistedMouthOpening', 'lateralExcursionRight', 'lateralExcursionLeft', 'protrusiveMovement', 'deviationOnOpening'],
  'pain-functional': ['jawPainIntensity', 'jawFunctionalLimitationScale', 'gcps_chronicPainGrade', 'bruxismPresence'],
  'joint-sounds': ['jointSoundsRight', 'jointSoundsLeft'],
  'muscle-palpation': ['masseterPalpationTenderness', 'temporalisPalpationTenderness', 'lateralPterygoidPalpation', 'medialPterygoidPalpation'],
  'capsular-joint': ['capsularTenderness'],
  'disc-assessment': ['discDisplacementClassification', 'mriDiscPosition', 'effusionPresence'],
  'dc-tmd-diagnosis': ['dc_tmdDiagnosis'],
  occlusion: ['occlusalClassification', 'overjetMeasurement', 'overbiteMeasurement'],
  'condylar-morphology': ['condylarMorphology'],
};

const BOOLEAN_FIELDS = new Set(['bruxismPresence', 'effusionPresence']);
const NUMBER_FIELDS = new Set(['maximalIncisorOpening', 'assistedMouthOpening', 'lateralExcursionRight', 'lateralExcursionLeft', 'protrusiveMovement', 'jawPainIntensity', 'jawFunctionalLimitationScale', 'overjetMeasurement', 'overbiteMeasurement']);
const ARRAY_FIELDS = new Set(['dc_tmdDiagnosis']);
const MOUTH_OPENING_SENTINEL_FIELDS = new Set(['maximalIncisorOpening', 'assistedMouthOpening']);
const COMMA_SPLIT_FIELDS = new Set(['deviationOnOpening', 'jointSoundsRight', 'jointSoundsLeft', 'masseterPalpationTenderness', 'temporalisPalpationTenderness', 'lateralPterygoidPalpation', 'medialPterygoidPalpation', 'discDisplacementClassification', 'condylarMorphology']);
const PERIOD_SPLIT_FIELDS = new Set(['deviationOnOpening', 'gcps_chronicPainGrade', 'jointSoundsRight', 'jointSoundsLeft', 'masseterPalpationTenderness', 'temporalisPalpationTenderness', 'lateralPterygoidPalpation', 'medialPterygoidPalpation', 'capsularTenderness', 'discDisplacementClassification', 'mriDiscPosition', 'occlusalClassification', 'condylarMorphology']);

const safeString = value => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
};

const parseLabel = text => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: text };
};

const splitByComma = text => {
  const source = String(text ?? '');
  const result = [];
  let current = '';
  let depth = 0;
  for (const character of source) {
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) { if (current.trim()) result.push(current.trim()); current = ''; }
    else current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};

const splitEditableClauses = (value, fieldPath) => {
  const source = String(value ?? '');
  const parts = [];
  let current = '';
  let depth = 0;
  const push = delimiter => { if (current.trim()) parts.push({ text: current.trim(), delimiter }); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || '';
    const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && PERIOD_SPLIT_FIELDS.has(fieldPath) && depth === 0 && /\s/.test(next)
      && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord)
      && !/\d$/.test(current);
    const safeComma = character === ',' && COMMA_SPLIT_FIELDS.has(fieldPath) && depth === 0;
    const safeSemicolon = character === ';' && depth === 0;
    if (safePeriod || safeComma || safeSemicolon) {
      let delimiter = character;
      while (/\s/.test(source[index + 1] || '')) { delimiter += source[index + 1]; index += 1; }
      push(delimiter);
    } else current += character;
  }
  push('');
  return parts.length ? parts : [{ text: source, delimiter: '' }];
};

const hasValue = (record, field) => {
  const value = record[field];
  if (value === null || value === undefined || value === '') return false;
  if (MOUTH_OPENING_SENTINEL_FIELDS.has(field) && (value === 0 || value === '0')) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(item => item !== null && item !== undefined && String(item).trim() !== '');
  return true;
};

const sameAsTitle = (label, sectionId) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sectionId] || '').trim().toLowerCase();

const formatNumber = (field, value) => {
  if (['maximalIncisorOpening', 'assistedMouthOpening', 'lateralExcursionRight', 'lateralExcursionLeft', 'protrusiveMovement', 'overjetMeasurement'].includes(field)) return `${value} mm`;
  if (['jawPainIntensity', 'jawFunctionalLimitationScale'].includes(field)) return `${value}/10`;
  if (field === 'overbiteMeasurement') return `${value}%`;
  return String(value);
};

const unwrapRecords = data => {
  if (!data) return [];
  const initial = Array.isArray(data) ? data : [data];
  return initial.flatMap(record => {
    if (record?.tmj_assessment) return Array.isArray(record.tmj_assessment) ? record.tmj_assessment : [record.tmj_assessment];
    if (record?.documentData) {
      const inner = record.documentData;
      if (Array.isArray(inner)) return inner;
      if (inner?.tmj_assessment) return Array.isArray(inner.tmj_assessment) ? inner.tmj_assessment : [inner.tmj_assessment];
      return [inner];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const TmjAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const fieldBody = (record, field, sectionId) => {
    if (!hasValue(record, field)) return [];
    const label = FIELD_LABELS[field] || field;
    const value = record[field];
    const elements = [];
    if (!sameAsTitle(label, sectionId)) elements.push(<Text key={`${field}-label`} style={styles.fieldLabel} minPresenceAhead={26}>{safeString(label)}</Text>);

    if (BOOLEAN_FIELDS.has(field)) {
      elements.push(<Text key={`${field}-value`} style={styles.value}>1. {value ? 'Yes' : 'No'}</Text>);
      return elements;
    }
    if (NUMBER_FIELDS.has(field)) {
      elements.push(<Text key={`${field}-value`} style={styles.value}>1. {safeString(formatNumber(field, value))}</Text>);
      return elements;
    }
    if (ARRAY_FIELDS.has(field)) {
      let number = 1;
      value.filter(Boolean).forEach((item, itemIndex) => {
        const parsed = parseLabel(String(item));
        if (parsed.isLabeled) {
          elements.push(<Text key={`${field}-${itemIndex}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
          elements.push(<Text key={`${field}-${itemIndex}-value`} style={styles.listItem}>{number++}. {safeString(parsed.value)}</Text>);
        } else elements.push(<Text key={`${field}-${itemIndex}`} style={styles.listItem}>{number++}. {safeString(item)}</Text>);
      });
      return elements;
    }

    let number = 1;
    splitEditableClauses(value, field).forEach((entry, entryIndex) => {
      const parsed = parseLabel(entry.text);
      if (parsed.isLabeled) {
        elements.push(<Text key={`${field}-${entryIndex}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
        splitByComma(parsed.value).forEach((item, commaIndex) => {
          elements.push(<Text key={`${field}-${entryIndex}-${commaIndex}`} style={styles.listItem}>{number++}. {safeString(item)}</Text>);
        });
      } else elements.push(<Text key={`${field}-${entryIndex}`} style={entryIndex === 0 ? styles.value : styles.listItem}>{number++}. {safeString(entry.text)}</Text>);
    });
    return elements;
  };

  const renderSection = (record, sectionId) => {
    let body = [];
    (SECTION_FIELDS[sectionId] || []).forEach(field => { body = body.concat(fieldBody(record, field, sectionId)); });
    if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sectionId}-${index}` }));
    const [first, ...rest] = body;
    return (
      <View key={sectionId}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>{safeString(SECTION_TITLES[sectionId])}</Text>
          {first}
        </View>
        {rest}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>TMJ Assessment</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No TMJ assessment records available</Text>}
        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>TMJ Assessment {index + 1}</Text>
            {Object.keys(SECTION_FIELDS).map(sectionId => renderSection(record, sectionId))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TmjAssessmentDocumentPDFTemplate;
