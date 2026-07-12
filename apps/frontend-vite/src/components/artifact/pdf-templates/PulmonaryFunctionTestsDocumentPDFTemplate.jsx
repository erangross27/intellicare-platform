/**
 * PulmonaryFunctionTestsDocumentPDFTemplate.jsx
 * Box-free canonical PDF - Helvetica - LETTER - pulmonary function tests
 * Collection: pulmonary_function_tests
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 8, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

/* safeString: \u-escapes only (no literal smart-quotes / invisible chars) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s
    .replace(/\u00d7/g, 'x')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00b5\u03bc]/g, 'u')
    .replace(/\u00b0/g, ' deg').replace(/\u00b1/g, '+/-')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=').replace(/\u2192/g, '->');
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return !isEmptyDeep(v);
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware with Oxford ("and"/"or") + numeric-thousands guards */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest) || /^\d/.test(text[i + 1] || '')) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= OBJECT (recursive) HELPERS ======= */
const KEY_OVERRIDES = {
  fev1: 'FEV1',
  fvc: 'FVC',
  fev1FvcRatio: 'FEV1/FVC Ratio',
  fef2575: 'FEF 25-75',
  rvTlcRatio: 'RV/TLC Ratio',
  totalLungCapacity: 'Total Lung Capacity',
  residualVolume: 'Residual Volume',
  functionalResidualCapacity: 'Functional Residual Capacity',
  dlco: 'DLCO',
  dlcoUncorrected: 'DLCO Uncorrected',
  dlcoCorrectedForHgb: 'DLCO Corrected for Hgb',
  alveolarVolume: 'Alveolar Volume',
  kco: 'KCO',
  fev1Improvement: 'FEV1 Improvement',
  fev1PercentImprovement: 'FEV1 % Improvement',
  fvcImprovement: 'FVC Improvement',
  fvcPercentImprovement: 'FVC % Improvement',
};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
function isEmptyDeep(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
}
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* ======= CONFIG (mirrors JSX) ======= */
const SECTION_TITLES = {
  'test-info': 'Test Information',
  'pre-bronchodilator': 'Pre-Bronchodilator',
  'post-bronchodilator': 'Post-Bronchodilator',
  'interpretation-section': 'Interpretation',
  'lung-volumes': 'Lung Volumes',
  'diffusion-capacity': 'Diffusion Capacity',
  'bronchodilator-response': 'Bronchodilator Response',
  'exercise-testing': 'Exercise Testing',
  'quality-section': 'Quality Assessment',
};
const SECTION_ORDER = ['test-info', 'pre-bronchodilator', 'post-bronchodilator', 'interpretation-section', 'lung-volumes', 'diffusion-capacity', 'bronchodilator-response', 'exercise-testing', 'quality-section'];
const SECTION_FIELDS = {
  'test-info': ['testDate', 'date', 'provider', 'technician', 'qualityGrade'],
  'pre-bronchodilator': ['preBronchodilator'],
  'post-bronchodilator': ['postBronchodilator'],
  'interpretation-section': ['interpretation', 'reversibility'],
  'lung-volumes': ['lungVolumes', 'comprehensiveLungVolumes', 'predictedPostoperativeFev1'],
  'diffusion-capacity': ['dlco', 'dlcoComprehensive'],
  'bronchodilator-response': ['bronchodilatorResponse'],
  'exercise-testing': ['sixMinuteWalkTest', 'cardiopulmonaryExerciseTest'],
  'quality-section': ['qualityAssessment', 'flowVolumeLoop'],
};
const FIELD_LABELS = {
  testDate: 'Test Date', date: 'Date', provider: 'Provider', technician: 'Technician', qualityGrade: 'Quality Grade',
  preBronchodilator: 'Pre-Bronchodilator', postBronchodilator: 'Post-Bronchodilator',
  interpretation: 'Interpretation', reversibility: 'Reversibility',
  lungVolumes: 'Lung Volumes', comprehensiveLungVolumes: 'Comprehensive Lung Volumes', predictedPostoperativeFev1: 'Predicted Postoperative FEV1',
  dlco: 'DLCO', dlcoComprehensive: 'DLCO Comprehensive', bronchodilatorResponse: 'Bronchodilator Response',
  sixMinuteWalkTest: 'Six-Minute Walk Test', cardiopulmonaryExerciseTest: 'Cardiopulmonary Exercise Test',
  qualityAssessment: 'Quality Assessment', flowVolumeLoop: 'Flow-Volume Loop',
};
const DATE_FIELDS = ['testDate', 'date'];
const OBJECT_FIELDS = ['preBronchodilator', 'postBronchodilator', 'lungVolumes', 'comprehensiveLungVolumes', 'predictedPostoperativeFev1', 'dlcoComprehensive', 'bronchodilatorResponse', 'sixMinuteWalkTest', 'cardiopulmonaryExerciseTest', 'qualityAssessment', 'flowVolumeLoop'];

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const labelEl = (f, key) => <Text key={key} style={styles.fieldLabel}>{FIELD_LABELS[f] || f}</Text>;

/* string field -> bare label + sentence/comma value lines (mirrors JSX renderStringField display) */
const stringFieldEls = (f, val, showLabel) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const els = [];
  if (showLabel) els.push(labelEl(f, `${f}-l`));
  if (sentences.length <= 1) {
    els.push(<Text key={`${f}-v`} style={styles.value}>{safeString(strVal)}</Text>);
    return els;
  }
  let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(<Text key={`${f}-sl${si}`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
      if (parts.length >= 2) parts.forEach((p, pi) => els.push(<Text key={`${f}-s${si}c${pi}`} style={styles.listItem}>{`${n++}. ${safeString(p)}`}</Text>));
      else els.push(<Text key={`${f}-s${si}v`} style={styles.listItem}>{`${n++}. ${safeString(parsed.value)}`}</Text>);
    } else {
      els.push(<Text key={`${f}-s${si}`} style={styles.listItem}>{`${n++}. ${safeString(s)}`}</Text>);
    }
  });
  return els;
};

/* recursive object node -> flat STACKED elements (sub-label humanizeKey ABOVE value; nested nodes recurse) */
const objectNodeEls = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return [];
  if (isScalar(value)) {
    const els = [];
    if (label) els.push(<Text key={`${keyPath}-l`} style={depth <= 1 ? styles.fieldLabel : styles.subLabel}>{safeString(label)}</Text>);
    els.push(<Text key={`${keyPath}-v`} style={styles.value}>{safeString(fmtScalar(value))}</Text>);
    return els;
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  const els = [];
  if (label) els.push(<Text key={`${keyPath}-l`} style={depth <= 1 ? styles.fieldLabel : styles.subLabel}>{safeString(label)}</Text>);
  entries.forEach(([k, v]) => els.push(...objectNodeEls(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1)));
  return els;
};

/* top-level OBJECT field -> flat stacked elements. showLabel emits the object label (single-name gated) */
const objectFieldEls = (f, val, showLabel) => {
  if (isEmptyDeep(val) || isScalar(val)) return [];
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  const els = [];
  if (showLabel) els.push(labelEl(f, `${f}-l`));
  entries.forEach(([k, v]) => els.push(...objectNodeEls(humanizeKey(k), v, `${f}-${k}`, 1)));
  return els;
};

/* dispatch one field -> flat element array */
const fieldEls = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = !sameAsTitle(label, sid);
  if (OBJECT_FIELDS.includes(f)) return objectFieldEls(f, val, showLabel);
  if (DATE_FIELDS.includes(f)) return [labelEl(f, `${f}-l`), <Text key={`${f}-v`} style={styles.value}>{formatDate(val)}</Text>];
  return stringFieldEls(f, val, showLabel);
};

/* ======= COMPONENT ======= */
const PulmonaryFunctionTestsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.pulmonary_function_tests) return Array.isArray(r.pulmonary_function_tests) ? r.pulmonary_function_tests : [r.pulmonary_function_tests];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pulmonary_function_tests) return Array.isArray(dd.pulmonary_function_tests) ? dd.pulmonary_function_tests : [dd.pulmonary_function_tests]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pulmonary Function Tests</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pulmonary Function Tests</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Pulmonary Function Test ${index + 1}`}</Text>
            </View>

            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid] || [];
              const flat = [];
              fields.forEach(f => flat.push(...fieldEls(record, f, sid)));
              if (flat.length === 0) return null;
              const first = React.cloneElement(flat[0], { key: 'f0' });
              const rest = flat.slice(1).map((el, i) => React.cloneElement(el, { key: `f${i + 1}` }));
              return (
                <View key={sid} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                    {first}
                  </View>
                  {rest}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PulmonaryFunctionTestsDocumentPDFTemplate;
