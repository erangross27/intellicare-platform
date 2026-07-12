import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PrePregnancyWeightDocumentPDFTemplate — box-free B&W LETTER rewrite
 * Config-driven mirror of PrePregnancyWeightDocument.jsx (section-driven flat).
 * Bare underlined field labels above stacked values; anti-orphan glue (section
 * title + first field kept together). No date is rendered — the record has no clinical
 * date field (only createdAt/updatedAt ingestion timestamps).
 */

/* ═══════ CONFIG (mirrors the JSX) ═══════ */
const SECTION_TITLES = {
  'measurements': 'Measurements',
  'weight-history': 'Weight History',
  'risk-factors': 'Risk Factors',
  'interventions': 'Interventions',
};

const FIELD_LABELS = {
  prePregnancyWeight: 'Pre-Pregnancy Weight',
  prePregnancyBmi: 'Pre-Pregnancy BMI',
  bmiCategory: 'BMI Category',
  heightMeasurement: 'Height Measurement',
  weightMeasurementMethod: 'Weight Measurement Method',
  obesityClass: 'Obesity Class',
  weightStability: 'Weight Stability',
  weightLossHistory: 'Weight Loss History',
  previousPregnancyWeightGain: 'Previous Pregnancy Weight Gain',
  gestationalWeightGainGoal: 'Gestational Weight Gain Goal',
  metabolicRiskFactors: 'Metabolic Risk Factors',
  insulinResistanceMarkers: 'Insulin Resistance Markers',
  prePregnancyA1c: 'Pre-Pregnancy A1c',
  thyroidFunction: 'Thyroid Function',
  cardiovascularRisk: 'Cardiovascular Risk',
  sleepApneaRisk: 'Sleep Apnea Risk',
  nutritionalDeficiencies: 'Nutritional Deficiencies',
  nutritionalCounseling: 'Nutritional Counseling',
  bariatricSurgeryHistory: 'Bariatric Surgery History',
  exerciseTolerance: 'Exercise Tolerance',
  eatingDisorderHistory: 'Eating Disorder History',
  contraceptiveWeightEffect: 'Contraceptive Weight Effect',
};

const SECTION_FIELDS = {
  'measurements': ['prePregnancyWeight', 'prePregnancyBmi', 'bmiCategory', 'heightMeasurement', 'weightMeasurementMethod', 'obesityClass'],
  'weight-history': ['weightStability', 'weightLossHistory', 'previousPregnancyWeightGain', 'gestationalWeightGainGoal'],
  'risk-factors': ['metabolicRiskFactors', 'insulinResistanceMarkers', 'prePregnancyA1c', 'thyroidFunction', 'cardiovascularRisk', 'sleepApneaRisk', 'nutritionalDeficiencies'],
  'interventions': ['nutritionalCounseling', 'bariatricSurgeryHistory', 'exerciseTolerance', 'eatingDisorderHistory', 'contraceptiveWeightEffect'],
};

const NUMBER_FIELDS = ['prePregnancyWeight', 'prePregnancyBmi', 'heightMeasurement', 'prePregnancyA1c', 'previousPregnancyWeightGain'];
const BOOLEAN_FIELDS = ['weightStability', 'nutritionalCounseling', 'bariatricSurgeryHistory', 'sleepApneaRisk', 'eatingDisorderHistory'];
const ARRAY_FIELDS = ['metabolicRiskFactors', 'nutritionalDeficiencies'];

/* ═══════ HELPERS (mirror the JSX) ═══════ */
const filterNulls = (arr) => (Array.isArray(arr) ? arr.filter(item => item !== null && item !== undefined) : []);

// Scrub glyphs Helvetica cannot render (multiplication sign → x, smart quotes/dashes → ascii, strip zero-width).
const safeString = (v) => {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/×/g, 'x')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[​‌‍﻿]/g, '');
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

// numShown: numeric fields (weight/BMI/height/A1c/weight-gain) have no meaningful zero — hide the 0 sentinel.
const numShown = (v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); return !Number.isNaN(n) && n !== 0; };

/* ═══════ STYLES (box-free) ═══════ */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#FFFFFF' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 18, marginBottom: 8 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 3 },
  value: { fontSize: 14, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 2, marginLeft: 12 },
  divider: { marginTop: 14, marginBottom: 14, borderBottomWidth: 0.5, borderBottomColor: '#cccccc' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 9, color: '#666666' },
});

/* Build the value elements for a STRING field (mirrors formatSentenceFieldLines numbering) */
function stringValueElements(strVal, keyPrefix) {
  const sentences = splitBySentence(strVal);
  const wholeParsed = parseLabel(strVal);
  const structured = sentences.length > 1 || (wholeParsed.isLabeled && splitByComma(wholeParsed.value).length >= 2);
  if (!structured) {
    return [<Text key={`${keyPrefix}-v`} style={styles.value}>{safeString(strVal)}</Text>];
  }
  const els = []; let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      els.push(<Text key={`${keyPrefix}-s${si}-l`} style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>);
      if (items.length >= 2) {
        items.forEach((it, ii) => els.push(<Text key={`${keyPrefix}-s${si}-i${ii}`} style={styles.listItem}>{n++}. {safeString(it)}</Text>));
      } else {
        els.push(<Text key={`${keyPrefix}-s${si}-v`} style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>);
      }
    } else {
      els.push(<Text key={`${keyPrefix}-s${si}`} style={styles.listItem}>{n++}. {safeString(s)}</Text>);
    }
  });
  return els;
}

/* Render a single field → a <View> block (bare label + stacked value), or null when empty/hidden */
function renderField(record, fn, keyPrefix) {
  const val = record[fn];
  const label = FIELD_LABELS[fn] || fn;
  const labelEl = <Text style={styles.fieldLabel}>{safeString(label)}</Text>;

  if (BOOLEAN_FIELDS.includes(fn)) {
    if (!hasVal(val)) return null;
    return (
      <View key={keyPrefix} style={styles.fieldBox}>
        {labelEl}
        <Text style={styles.value}>{val ? 'Yes' : 'No'}</Text>
      </View>
    );
  }

  if (NUMBER_FIELDS.includes(fn)) {
    if (!numShown(val)) return null;
    return (
      <View key={keyPrefix} style={styles.fieldBox}>
        {labelEl}
        <Text style={styles.value}>{safeString(String(val))}</Text>
      </View>
    );
  }

  if (ARRAY_FIELDS.includes(fn)) {
    const items = filterNulls(Array.isArray(val) ? val : []).map(String).filter(s => s.trim());
    if (items.length === 0) return null;
    return (
      <View key={keyPrefix} style={styles.fieldBox}>
        {labelEl}
        {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>)}
      </View>
    );
  }

  if (!hasVal(val)) return null;
  return (
    <View key={keyPrefix} style={styles.fieldBox}>
      {labelEl}
      {stringValueElements(String(val), keyPrefix)}
    </View>
  );
}

/* Render a section with anti-orphan glue (title + first field kept together) */
function renderSection(record, sid, idx) {
  const fields = SECTION_FIELDS[sid] || [];
  const els = fields.map((f, fi) => renderField(record, f, `${sid}-${idx}-${fi}`)).filter(Boolean);
  if (els.length === 0) return null;
  const title = SECTION_TITLES[sid];
  const [first, ...rest] = els;
  return (
    <View key={sid} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {first}
      </View>
      {rest.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </View>
  );
}

const PrePregnancyWeightDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data?.pre_pregnancy_weight && Array.isArray(data.pre_pregnancy_weight)) records = data.pre_pregnancy_weight;
  else if (data?.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) records = dd;
    else if (dd?.pre_pregnancy_weight) records = Array.isArray(dd.pre_pregnancy_weight) ? dd.pre_pregnancy_weight : [dd.pre_pregnancy_weight];
    else if (dd && typeof dd === 'object') records = [dd];
  } else if (data && typeof data === 'object') records = [data];
  records = filterNulls(records);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pre-Pregnancy Weight</Text>
          <Text style={styles.value}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pre-Pregnancy Weight</Text>

        {records.map((record, idx) => (
          <View key={idx}>
            <Text style={styles.recordTitle}>Pre-Pregnancy Weight {idx + 1}</Text>
            {Object.keys(SECTION_TITLES).map(sid => renderSection(record, sid, idx))}
            {idx < records.length - 1 && <View style={styles.divider} />}
          </View>
        ))}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default PrePregnancyWeightDocumentPDFTemplate;
