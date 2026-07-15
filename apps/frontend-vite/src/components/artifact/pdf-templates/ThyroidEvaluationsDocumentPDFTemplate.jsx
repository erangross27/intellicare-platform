/**
 * ThyroidEvaluationsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free — thyroid evaluations
 * Collection: thyroid_evaluations
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
  'thyroid-labs': 'Thyroid Labs',
  antibodies: 'Antibodies',
  'clinical-status': 'Clinical Status',
  'palpation-exam': 'Palpation and Exam',
  imaging: 'Imaging',
  biopsy: 'Biopsy',
  medications: 'Medications',
};

const FIELD_LABELS = {
  tshLevel: 'TSH Level',
  freeT4Level: 'Free T4 Level',
  freeT3Level: 'Free T3 Level',
  totalT4Level: 'Total T4 Level',
  totalT3Level: 'Total T3 Level',
  thyroglobulinLevel: 'Thyroglobulin Level',
  antiTPOAntibodies: 'Anti-TPO Antibodies',
  antiThyroglobulinAntibodies: 'Anti-Thyroglobulin Antibodies',
  tsiLevel: 'TSI Level',
  traAntibodies: 'TRAb Antibodies',
  clinicalThyroidFunction: 'Clinical Thyroid Function',
  thyroidSymptomScore: 'Thyroid Symptom Score',
  wayneThyrotoxicosisIndex: 'Wayne Thyrotoxicosis Index',
  goiterClassification: 'Goiter Classification',
  thyroidGlandSize: 'Thyroid Gland Size',
  thyroidPalpationFindings: 'Palpation Findings',
  ultrasoundFindings: 'Ultrasound Findings',
  tiRadsScore: 'TI-RADS Score',
  noduleCharacteristics: 'Nodule Characteristics',
  thyroidScintigraphyPattern: 'Scintigraphy Pattern',
  radioiodineUptakeTest: 'Radioiodine Uptake Test',
  fnaBiopsyResults: 'FNA Biopsy Results',
  bethesdaCategory: 'Bethesda Category',
  thyroidMedications: 'Thyroid Medications',
};

const SECTION_FIELDS = {
  'thyroid-labs': ['tshLevel', 'freeT4Level', 'freeT3Level', 'totalT4Level', 'totalT3Level', 'thyroglobulinLevel'],
  antibodies: ['antiTPOAntibodies', 'antiThyroglobulinAntibodies', 'tsiLevel', 'traAntibodies'],
  'clinical-status': ['clinicalThyroidFunction', 'thyroidSymptomScore', 'wayneThyrotoxicosisIndex', 'goiterClassification'],
  'palpation-exam': ['thyroidGlandSize', 'thyroidPalpationFindings'],
  imaging: ['ultrasoundFindings', 'tiRadsScore', 'noduleCharacteristics', 'thyroidScintigraphyPattern', 'radioiodineUptakeTest'],
  biopsy: ['fnaBiopsyResults', 'bethesdaCategory'],
  medications: ['thyroidMedications'],
};

const NUMBER_FIELDS = ['tshLevel', 'freeT4Level', 'freeT3Level', 'totalT4Level', 'totalT3Level', 'thyroglobulinLevel', 'antiTPOAntibodies', 'antiThyroglobulinAntibodies', 'tsiLevel', 'traAntibodies', 'thyroidSymptomScore', 'wayneThyrotoxicosisIndex', 'tiRadsScore', 'radioiodineUptakeTest', 'bethesdaCategory'];
const ZERO_SENTINEL_FIELDS = [...NUMBER_FIELDS];
const ARRAY_FIELDS = ['noduleCharacteristics', 'thyroidMedications'];
const COMMA_SPLIT_FIELDS = ['thyroidPalpationFindings'];

const safeString = value => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
};

const parseLabel = text => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: text };
};

const splitBySentence = text => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?:(?<!\b[A-Z])(?<!\d)\.\s+|;\s+)/).map(part => part.trim()).filter(part => part && !/^[;.,!?]+$/.test(part));
};

const splitByComma = text => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = [];
  let current = '';
  let depth = 0;
  for (const char of text) {
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();
const shouldCommaSplit = (fn, value) => COMMA_SPLIT_FIELDS.includes(fn) && splitBySentence(value).length <= 1 && !parseLabel(value).isLabeled && splitByComma(value).length >= 2;

const hasVal = (record, fn) => {
  const value = record[fn];
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number') return !(ZERO_SENTINEL_FIELDS.includes(fn) && value === 0);
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(item => item !== null && item !== undefined && String(item).trim() !== '');
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const unwrapRecords = data => {
  if (!data) return [];
  const initial = Array.isArray(data) ? data : [data];
  return initial.flatMap(record => {
    if (record?.thyroid_evaluations) return Array.isArray(record.thyroid_evaluations) ? record.thyroid_evaluations : [record.thyroid_evaluations];
    if (record?.documentData) {
      const inner = record.documentData;
      if (Array.isArray(inner)) return inner;
      if (inner?.thyroid_evaluations) return Array.isArray(inner.thyroid_evaluations) ? inner.thyroid_evaluations : [inner.thyroid_evaluations];
      return [inner];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const ThyroidEvaluationsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const sentenceElements = (value, keyBase) => {
    const elements = [];
    let number = 1;
    splitBySentence(value).forEach((sentence, sentenceIdx) => {
      const parsed = parseLabel(sentence);
      if (parsed.isLabeled) {
        elements.push(<Text key={`${keyBase}-s${sentenceIdx}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
        splitByComma(parsed.value).forEach((part, partIdx) => {
          elements.push(<Text key={`${keyBase}-s${sentenceIdx}-p${partIdx}`} style={styles.listItem}>{number++}. {safeString(part)}</Text>);
        });
      } else elements.push(<Text key={`${keyBase}-s${sentenceIdx}`} style={styles.value}>{number++}. {safeString(sentence)}</Text>);
    });
    return elements;
  };

  const fieldBody = (record, fn, sid) => {
    if (!hasVal(record, fn)) return [];
    const label = FIELD_LABELS[fn] || fn;
    const value = record[fn];
    const elements = [];
    if (!sameAsTitle(label, sid)) elements.push(<Text key={`${fn}-label`} style={styles.fieldLabel}>{safeString(label)}</Text>);

    if (ARRAY_FIELDS.includes(fn)) {
      let number = 1;
      value.filter(Boolean).forEach((item, itemIdx) => {
        const parsed = parseLabel(String(item));
        if (parsed.isLabeled) {
          elements.push(<Text key={`${fn}-${itemIdx}-label`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
          elements.push(<Text key={`${fn}-${itemIdx}-value`} style={styles.listItem}>{number++}. {safeString(parsed.value)}</Text>);
        } else elements.push(<Text key={`${fn}-${itemIdx}`} style={styles.listItem}>{number++}. {safeString(item)}</Text>);
      });
      return elements;
    }

    if (NUMBER_FIELDS.includes(fn)) {
      elements.push(<Text key={`${fn}-value`} style={styles.value}>1. {safeString(value)}</Text>);
      return elements;
    }

    const stringValue = safeString(value);
    if (shouldCommaSplit(fn, stringValue)) {
      splitByComma(stringValue).forEach((part, partIdx) => elements.push(<Text key={`${fn}-c${partIdx}`} style={styles.listItem}>{partIdx + 1}. {safeString(part)}</Text>));
    } else if (splitBySentence(stringValue).length > 1 || parseLabel(stringValue).isLabeled) {
      sentenceElements(stringValue, fn).forEach(element => elements.push(element));
    } else elements.push(<Text key={`${fn}-value`} style={styles.value}>1. {stringValue}</Text>);
    return elements;
  };

  const renderSection = (record, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    let body = [];
    fields.forEach(fn => { body = body.concat(fieldBody(record, fn, sid)); });
    if (!body.length) return null;
    body = body.map((element, idx) => React.cloneElement(element, { key: `${sid}-${idx}` }));
    const [first, ...rest] = body;
    return (
      <View key={sid}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>{safeString(SECTION_TITLES[sid])}</Text>
          {first}
        </View>
        {rest}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Thyroid Evaluations</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No thyroid evaluation records available</Text>}
        {records.map((record, idx) => (
          <View key={idx} break={idx > 0}>
            <Text style={styles.recordTitle}>{record.clinicalThyroidFunction ? `Thyroid Evaluation - ${safeString(record.clinicalThyroidFunction)}` : `Thyroid Evaluation ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ThyroidEvaluationsDocumentPDFTemplate;
