/**
 * PulmonologyConsultationsDocumentPDFTemplate.jsx
 * Box-free LETTER PDF for pulmonology_consultations.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  record: { paddingBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginTop: 12, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 7, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const SECTION_TITLES = {
  'visit-info': 'Visit Information',
  diagnosis: 'Diagnosis',
  'secondary-diagnoses': 'Secondary Diagnoses',
  'pulmonary-function': 'Pulmonary Function Tests',
  'arterial-blood-gas': 'Arterial Blood Gas',
  'respiratory-vitals': 'Respiratory Vitals',
  'oxygen-therapy': 'Oxygen Therapy',
  symptoms: 'Symptoms',
  medications: 'Respiratory Medications',
  bronchodilators: 'Bronchodilators',
  corticosteroids: 'Corticosteroids',
  smoking: 'Smoking History',
  'smoking-cessation': 'Smoking Cessation',
  imaging: 'Imaging',
  'assessment-plan': 'Assessment and Plan',
  results: 'Results',
  recommendations: 'Recommendations',
};

const SECTION_ORDER = [
  'visit-info', 'diagnosis', 'secondary-diagnoses', 'pulmonary-function',
  'arterial-blood-gas', 'respiratory-vitals', 'oxygen-therapy', 'symptoms',
  'medications', 'bronchodilators', 'corticosteroids', 'smoking',
  'smoking-cessation', 'imaging', 'assessment-plan', 'results', 'recommendations',
];

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  primaryDiagnosis: 'Primary Diagnosis',
  severity: 'Severity',
  exacerbationRisk: 'Exacerbation Risk',
  secondaryDiagnoses: 'Secondary Diagnoses',
  'pulmonaryFunctionTests.fev1': 'FEV1',
  'pulmonaryFunctionTests.fvc': 'FVC',
  'pulmonaryFunctionTests.fev1FvcRatio': 'FEV1/FVC Ratio',
  'pulmonaryFunctionTests.dlco': 'DLCO',
  'pulmonaryFunctionTests.interpretation': 'Interpretation',
  'pulmonaryFunctionTests.date': 'PFT Date',
  peakFlow: 'Peak Flow',
  respiratoryRate: 'Respiratory Rate',
  oxygenSaturation: 'Oxygen Saturation (SpO2)',
  breathingSounds: 'Breathing Sounds',
  chestPain: 'Chest Pain',
  respiratoryMedications: 'Respiratory Medications',
  smokingStatus: 'Smoking Status',
  packYears: 'Pack Years',
  quitDate: 'Quit Date',
  chestXrayFindings: 'Chest X-ray Findings',
  ctScanFindings: 'CT Scan Findings',
  imagingDate: 'Imaging Date',
  assessment: 'Assessment',
  plan: 'Plan',
  findings: 'Findings',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'visit-info': ['date', 'type', 'provider', 'facility', 'status'],
  diagnosis: ['primaryDiagnosis', 'severity', 'exacerbationRisk'],
  'secondary-diagnoses': ['secondaryDiagnoses'],
  'pulmonary-function': ['pulmonaryFunctionTests.fev1', 'pulmonaryFunctionTests.fvc', 'pulmonaryFunctionTests.fev1FvcRatio', 'pulmonaryFunctionTests.dlco', 'pulmonaryFunctionTests.interpretation', 'pulmonaryFunctionTests.date', 'peakFlow'],
  'respiratory-vitals': ['respiratoryRate', 'oxygenSaturation'],
  symptoms: ['breathingSounds', 'chestPain'],
  medications: ['respiratoryMedications'],
  smoking: ['smokingStatus', 'packYears', 'quitDate'],
  imaging: ['chestXrayFindings', 'ctScanFindings', 'imagingDate'],
  'assessment-plan': ['assessment', 'plan', 'findings', 'notes'],
};

const DATE_FIELDS = ['date', 'pulmonaryFunctionTests.date', 'quitDate', 'imagingDate'];
const NUMBER_FIELDS = ['respiratoryRate', 'oxygenSaturation', 'packYears'];
const ARRAY_FIELDS = ['secondaryDiagnoses', 'respiratoryMedications'];
const MEANINGFUL_ZERO_FIELDS = [];

const safeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value)
    .replace(/\u00d7/g, 'x')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ');
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value.$date || value);
    if (isNaN(date.getTime())) return safeString(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};

const getPath = (record, path) => String(path).split('.').reduce((value, key) => value?.[key], record);
const isEpochSentinel = (value) => {
  if (!value) return false;
  try { const date = new Date(value.$date || value); return !isNaN(date.getTime()) && date.getUTCFullYear() <= 1970; } catch { return false; }
};
const isHiddenZero = (field, value) => NUMBER_FIELDS.includes(field) && Number(value) === 0 && !MEANINGFUL_ZERO_FIELDS.includes(field);
const isEmptyDeep = (value) => {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'boolean') return false;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isEmptyDeep);
  if (typeof value === 'object') return Object.values(value).every(isEmptyDeep);
  return false;
};
const hasFieldValue = (record, field) => {
  const value = getPath(record, field);
  if (isHiddenZero(field, value)) return false;
  if (DATE_FIELDS.includes(field) && isEpochSentinel(value)) return false;
  return !isEmptyDeep(value);
};

const humanizeKey = (key) => String(key || '')
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, (char) => char.toUpperCase());
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map((part) => part.trim()).filter((part) => part && !/^[;.,!?]+$/.test(part));
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: text };
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '(') { depth += 1; current += char; }
    else if (char === ')') { depth = Math.max(0, depth - 1); current += char; }
    else if (char === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const value = current.trim(); if (value) result.push(value); current = ''; }
    else current += char;
  }
  const value = current.trim(); if (value) result.push(value);
  return result.length ? result : [text];
};

const unwrapData = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap(unwrapData);
  if (input.pulmonology_consultations) return unwrapData(input.pulmonology_consultations);
  if (input.documentData) return unwrapData(input.documentData);
  if (input.data) return unwrapData(input.data);
  if (input.records) return unwrapData(input.records);
  return [input];
};

const PulmonologyConsultationsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapData(data).filter((record) => record && typeof record === 'object');

  const labelElement = (label, key, sub = false) => <Text key={`${key}-label`} style={sub ? styles.subLabel : styles.fieldLabel}>{safeString(label)}</Text>;
  const valueElement = (value, key, list = false) => <Text key={`${key}-value`} style={list ? styles.listItem : styles.value}>{safeString(value)}</Text>;

  const sentenceElements = (text, keyBase) => {
    const sentences = splitBySentence(safeString(text));
    const elements = []; let n = 1;
    sentences.forEach((sentence, sentenceIndex) => {
      const parsed = parseLabel(sentence);
      if (parsed.isLabeled) {
        elements.push(labelElement(parsed.label, `${keyBase}-s${sentenceIndex}`, true));
        const parts = splitByComma(parsed.value);
        parts.forEach((part, partIndex) => elements.push(valueElement(`${n++}. ${part}`, `${keyBase}-s${sentenceIndex}-p${partIndex}`, true)));
      } else {
        elements.push(valueElement(`${n++}. ${sentence}`, `${keyBase}-s${sentenceIndex}`));
      }
    });
    return elements;
  };

  const fieldElements = (record, field, sid) => {
    if (!hasFieldValue(record, field)) return [];
    const value = getPath(record, field);
    const label = FIELD_LABELS[field] || humanizeKey(field);
    const elements = [];
    if (!sameAsTitle(label, sid)) elements.push(labelElement(label, field));
    if (DATE_FIELDS.includes(field)) {
      elements.push(valueElement(`1. ${formatDate(value)}`, field));
    } else if (ARRAY_FIELDS.includes(field)) {
      (Array.isArray(value) ? value : [value]).filter((item) => !isEmptyDeep(item)).forEach((item, index) => elements.push(valueElement(`${index + 1}. ${safeString(item)}`, `${field}-${index}`, true)));
    } else if (NUMBER_FIELDS.includes(field)) {
      elements.push(valueElement(`1. ${safeString(value)}`, field));
    } else {
      const stringValue = safeString(value);
      const sentences = splitBySentence(stringValue);
      if (sentences.length > 1 || parseLabel(stringValue).isLabeled) elements.push(...sentenceElements(stringValue, field));
      else elements.push(valueElement(`1. ${stringValue}`, field));
    }
    return elements;
  };

  const pairElements = (pairs, keyBase) => {
    const elements = [];
    pairs.filter(([, value]) => !isEmptyDeep(value)).forEach(([label, value], index) => {
      elements.push(labelElement(label, `${keyBase}-${index}`));
      elements.push(valueElement(`1. ${safeString(value)}`, `${keyBase}-${index}`));
    });
    return elements;
  };

  const recursiveResultElements = (object, prefix = '', keyBase = 'result') => {
    const elements = [];
    if (!object || typeof object !== 'object') return elements;
    Object.entries(object).filter(([key, value]) => key !== '_id' && key !== '$oid' && !isEmptyDeep(value)).forEach(([key, value], index) => {
      const label = prefix ? `${prefix} - ${humanizeKey(key)}` : humanizeKey(key);
      if (Array.isArray(value)) {
        elements.push(labelElement(label, `${keyBase}-${index}`));
        value.filter((item) => !isEmptyDeep(item)).forEach((item, itemIndex) => elements.push(valueElement(`${itemIndex + 1}. ${safeString(item)}`, `${keyBase}-${index}-${itemIndex}`, true)));
      } else if (value && typeof value === 'object' && !value.$date) {
        elements.push(...recursiveResultElements(value, label, `${keyBase}-${index}`));
      } else {
        elements.push(labelElement(label, `${keyBase}-${index}`));
        elements.push(valueElement(`1. ${safeString(value)}`, `${keyBase}-${index}`));
      }
    });
    return elements;
  };

  const sectionBody = (record, sid) => {
    if (SECTION_FIELDS[sid]) return SECTION_FIELDS[sid].flatMap((field) => fieldElements(record, field, sid));

    if (sid === 'arterial-blood-gas') {
      const value = record.arterialBloodGas;
      if (!value || isEmptyDeep(value)) return [];
      return pairElements([['pH', value.pH], ['paCO2', value.paCO2], ['paO2', value.paO2], ['HCO3', value.hco3], ['Interpretation', value.interpretation]], sid);
    }
    if (sid === 'oxygen-therapy') {
      const value = record.oxygenTherapy;
      if (!value || isEmptyDeep(value)) return [];
      return pairElements([['Prescribed', typeof value.prescribed === 'boolean' ? (value.prescribed ? 'Yes' : 'No') : ''], ['Delivery Method', value.deliveryMethod], ['Flow Rate', value.flowRate], ['Duration', value.duration]], sid);
    }
    if (sid === 'bronchodilators') {
      const elements = [];
      (record.bronchodilators || []).filter((item) => !isEmptyDeep(item)).forEach((item, index) => {
        elements.push(labelElement(`${item.medication || 'Bronchodilator'}${item.type ? ` (${item.type})` : ''}`, `${sid}-${index}`, true));
        elements.push(...pairElements([['Dose', item.dose], ['Device', item.device]], `${sid}-${index}`));
      });
      return elements;
    }
    if (sid === 'corticosteroids') {
      const elements = [];
      (record.corticosteroids || []).filter((item) => !isEmptyDeep(item)).forEach((item, index) => {
        elements.push(labelElement(item.medication || 'Corticosteroid', `${sid}-${index}`, true));
        elements.push(...pairElements([['Route', item.route], ['Dose', item.dose]], `${sid}-${index}`));
      });
      return elements;
    }
    if (sid === 'smoking-cessation') return recursiveResultElements(record.smokingCessation, '', sid);
    if (sid === 'results') return recursiveResultElements(record.results, '', sid);
    if (sid === 'recommendations') {
      const groups = (record.recommendations || []).reduce((acc, item) => { const key = item?.date || 'No Date'; (acc[key] ||= []).push(item); return acc; }, {});
      const elements = [];
      Object.entries(groups).forEach(([date, items], groupIndex) => {
        elements.push(labelElement(date, `${sid}-${groupIndex}`, true));
        items.forEach((item, itemIndex) => elements.push(valueElement(`${itemIndex + 1}. ${safeString(typeof item === 'string' ? item : item.recommendation)}`, `${sid}-${groupIndex}-${itemIndex}`, true)));
      });
      return elements;
    }
    return [];
  };

  const symptomBody = (record) => {
    const elements = SECTION_FIELDS.symptoms.flatMap((field) => fieldElements(record, field, 'symptoms'));
    const cough = record.cough;
    if (cough && !isEmptyDeep(cough)) {
      elements.push(labelElement('Cough', 'cough', true));
      elements.push(...pairElements([['Present', typeof cough.present === 'boolean' ? (cough.present ? 'Yes' : 'No') : ''], ['Type', cough.type], ['Sputum', cough.sputum]], 'cough'));
    }
    const dyspnea = record.dyspnea;
    if (dyspnea && !isEmptyDeep(dyspnea)) {
      elements.push(labelElement('Dyspnea', 'dyspnea', true));
      elements.push(...pairElements([['Severity', dyspnea.severity], ['Triggers', dyspnea.triggers], ['mMRC', typeof dyspnea.mMRCScale === 'number' ? dyspnea.mMRCScale : '']], 'dyspnea'));
    }
    return elements;
  };

  /* Convert flat label/value Text nodes into small atomic blocks. A sub-label travels with its
     first labeled leaf; a field label travels with its first value. This prevents page-bottom
     orphans such as "Cough" or "Dose" without making the whole section unbreakable. */
  const atomicBlocks = (elements, sid) => {
    const blocks = [];
    let index = 0;
    const isFieldLabel = (element) => element?.props?.style === styles.fieldLabel;
    const isSubLabel = (element) => element?.props?.style === styles.subLabel;
    const isLabel = (element) => isFieldLabel(element) || isSubLabel(element);

    while (index < elements.length) {
      const group = [elements[index]];
      const startsSubLabel = isSubLabel(elements[index]);
      const startsFieldLabel = isFieldLabel(elements[index]);
      index += 1;

      if (startsSubLabel && index < elements.length && isFieldLabel(elements[index])) {
        group.push(elements[index]);
        index += 1;
      } else if (startsFieldLabel && index < elements.length && isSubLabel(elements[index])) {
        group.push(elements[index]);
        index += 1;
      }

      while (index < elements.length && !isLabel(elements[index])) {
        group.push(elements[index]);
        index += 1;
      }

      blocks.push(
        <View key={`${sid}-block-${blocks.length}`} wrap={group.length > 8 ? true : false}>
          {group}
        </View>,
      );
    }
    return blocks;
  };

  const renderSection = (record, sid) => {
    let body = sid === 'symptoms' ? symptomBody(record) : sectionBody(record, sid);
    if (!body.length) return null;
    body = atomicBlocks(body, sid);
    const [first, ...rest] = body;
    const firstWithTitle = React.cloneElement(first, {
      key: `${sid}-first`,
      children: [<Text key={`${sid}-title`} style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>, ...React.Children.toArray(first.props.children)],
    });
    return (
      <View key={sid}>
        {firstWithTitle}
        {rest}
      </View>
    );
  };

  if (!records.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pulmonology Consultations</Text>
          <Text style={styles.noDataText}>No pulmonology consultation records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pulmonology Consultations</Text>
        {records.map((record, index) => (
          <View key={record._id?.$oid || record._id || index} style={styles.record} break={index > 0}>
            <Text style={styles.recordTitle}>Pulmonology Consultation {index + 1}</Text>
            {SECTION_ORDER.map((sid) => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PulmonologyConsultationsDocumentPDFTemplate;
