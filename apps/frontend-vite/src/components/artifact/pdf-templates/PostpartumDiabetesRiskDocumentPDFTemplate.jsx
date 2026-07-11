/**
 * PostpartumDiabetesRiskDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER size — postpartum diabetes risk
 * Collection: postpartum_diabetes_risk
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 20, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#666666', textAlign: 'center', marginTop: 40 },
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

/* Helvetica has no glyph for U+00D7 (multiplication sign) — scrub to 'x' */
const safeString = (val) => {
  let s;
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s.replace(/×/g, 'x');
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    else if (ch === ',' && depth === 0) {
      const nextIsSpace = /\s/.test(text[i + 1] || '');
      const nextIsYear = /^\s*\d{4}\b/.test(text.slice(i + 1));
      if (nextIsSpace && !nextIsYear) { const t = current.trim(); if (t) result.push(t); current = ''; }
      else { current += ch; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= FIELD RENDERERS (bare Views — the section glue owns the only wrap=false) ======= */
const renderScalarField = (label, text, showLabel) => (
  <View style={styles.fieldBox}>
    {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <Text style={styles.fieldValue}>{safeString(text)}</Text>
  </View>
);

/* sentence field: split by sentence, parseLabel, comma-list (mirror of the JSX string renderer) */
const renderSentenceField = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);
  const parsedWhole = parseLabel(strVal);
  const singleLabeledList = sentences.length === 1 && parsedWhole.isLabeled && splitByComma(parsedWhole.value).length >= 2;

  if (sentences.length <= 1 && !singleLabeledList) {
    return (
      <View style={styles.fieldBox}>
        {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{safeString(strVal)}</Text>
      </View>
    );
  }

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      if (items.length >= 2) {
        items.forEach(it => { rows.push({ type: 'item', text: safeString(it), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(parsed.value), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  return (
    <View style={styles.fieldBox}>
      {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{r.text}</Text>
        : <Text key={i} style={styles.listItem}>{r.num}. {r.text}</Text>)}
    </View>
  );
};

/* ======= SECTION CONFIGS (mirror JSX SECTION_FIELDS) ======= */
const SECTION_CONFIGS = [
  { title: 'Glucose Metrics', fields: [
    { key: 'oralGlucoseToleranceTest', label: 'Oral Glucose Tolerance Test', isNumber: true },
    { key: 'fastingPlasmaGlucose', label: 'Fasting Plasma Glucose', isNumber: true },
    { key: 'hemoglobinA1c', label: 'Hemoglobin A1c', isNumber: true },
    { key: 'postpartumScreeningDate', label: 'Postpartum Screening Date', isDate: true },
  ] },
  { title: 'Risk Factors', fields: [
    { key: 'gestationalDiabetesHistory', label: 'Gestational Diabetes History', isBoolean: true },
    { key: 'familyHistoryDiabetes', label: 'Family History of Diabetes', isBoolean: true },
    { key: 'polycysticOvarySyndrome', label: 'Polycystic Ovary Syndrome', isBoolean: true },
    { key: 'insulinTherapyDuringPregnancy', label: 'Insulin Therapy During Pregnancy', isBoolean: true },
    { key: 'macrosomiaHistory', label: 'Macrosomia History', isBoolean: true },
    { key: 'previousStillbirth', label: 'Previous Stillbirth', isBoolean: true },
    { key: 'hypertensiveDisorders', label: 'Hypertensive Disorders', isBoolean: true },
  ] },
  { title: 'Metabolic Profile', fields: [
    { key: 'prepregnancyBmi', label: 'Pre-Pregnancy BMI', isNumber: true },
    { key: 'currentBmi', label: 'Current BMI', isNumber: true },
    { key: 'gestationalWeightGain', label: 'Gestational Weight Gain', isNumber: true },
    { key: 'triglycerideLevels', label: 'Triglyceride Levels', isNumber: true },
    { key: 'hdlCholesterol', label: 'HDL Cholesterol', isNumber: true },
    { key: 'metabolicSyndrome', label: 'Metabolic Syndrome', isBoolean: true },
  ] },
  { title: 'Current Status', fields: [
    { key: 'breastfeedingStatus', label: 'Breastfeeding Status', isSentence: true },
    { key: 'ethnicRiskGroup', label: 'Ethnic Risk Group', isSentence: true },
    { key: 'maternalAge', label: 'Maternal Age', isNumber: true },
    { key: 'thyroidDisorders', label: 'Thyroid Disorders', isBoolean: true },
    { key: 'corticosteroidUse', label: 'Corticosteroid Use', isBoolean: true },
    { key: 'contraceptiveMethod', label: 'Contraceptive Method', isSentence: true },
  ] },
];

/* ======= COMPONENT ======= */
const PostpartumDiabetesRiskDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.postpartum_diabetes_risk) return Array.isArray(r.postpartum_diabetes_risk) ? r.postpartum_diabetes_risk : [r.postpartum_diabetes_risk];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.postpartum_diabetes_risk) return Array.isArray(dd.postpartum_diabetes_risk) ? dd.postpartum_diabetes_risk : [dd.postpartum_diabetes_risk]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Postpartum Diabetes Risk</Text>
          <Text style={styles.noDataText}>No postpartum diabetes risk records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Postpartum Diabetes Risk</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Postpartum Diabetes Risk {idx + 1}</Text>
            </View>

            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const visible = cfg.fields.filter(f => hasVal(record[f.key]));
              if (!visible.length) return null;
              const elements = visible.map((f) => {
                const showLabel = !sameAsTitle(f.label, cfg.title);
                const val = record[f.key];
                let el = null;
                if (f.isDate) el = renderScalarField(f.label, formatDate(val), showLabel);
                else if (f.isBoolean) el = renderScalarField(f.label, val ? 'Yes' : 'No', showLabel);
                else if (f.isNumber) el = renderScalarField(f.label, String(val), showLabel);
                else el = renderSentenceField(f.label, val, showLabel);
                return el ? <React.Fragment key={f.key}>{el}</React.Fragment> : null;
              }).filter(Boolean);
              if (!elements.length) return null;
              const [first, ...rest] = elements;

              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
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

export default PostpartumDiabetesRiskDocumentPDFTemplate;
