/**
 * FitnessForDutyEvaluationsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: numbers/booleans/enum canonical numbered,
 * returnToWorkDate via formatDate (NOT createdAt), comma-list result fields split per item, narrative fields
 * split on [.;] into clauses (labeled → sub-label). Rule #74: each field is ONE wrap={false} atomic View with
 * the sectionTitle riding INSIDE the first present field's View. Static PHI footer. break={idx>0}.
 * Collection: fitness_for_duty_evaluations
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['employee-info', 'pulmonary', 'vision-hearing', 'cardiovascular-fitness', 'musculoskeletal', 'clearances', 'risk-assessment'];
const SECTION_TITLES = {
  'employee-info': 'Employee Information', 'pulmonary': 'Pulmonary Function', 'vision-hearing': 'Vision & Hearing',
  'cardiovascular-fitness': 'Cardiovascular Fitness', 'musculoskeletal': 'Musculoskeletal Assessment',
  'clearances': 'Clearances & Compliance', 'risk-assessment': 'Risk Assessment',
};
const SECTION_FIELDS = {
  'employee-info': ['employeeIdentifier', 'jobClassification', 'physicalDemandsLevel', 'functionalCapacityRating', 'returnToWorkDate'],
  'pulmonary': ['vitalCapacity', 'fev1Measurement', 'peakFlowRate', 'respiratoryClearance'],
  'vision-hearing': ['snellenVisualAcuity', 'colorVisionStatus', 'peripheralVisionFields', 'audiometryResults'],
  'cardiovascular-fitness': ['stressTestResult', 'maximumOxygenUptake'],
  'musculoskeletal': ['gripStrengthMeasurement', 'rangeOfMotionAssessment', 'liftingCapacityTest', 'balanceStabilityAssessment'],
  'clearances': ['psychologicalClearance', 'substanceScreeningResults', 'immunizationStatus', 'dotPhysicalClassification', 'medicalRestrictions'],
  'risk-assessment': ['occupationalHealthRisk'],
};
const FIELD_LABELS = {
  employeeIdentifier: 'Employee Identifier', jobClassification: 'Job Classification', physicalDemandsLevel: 'Physical Demands Level',
  functionalCapacityRating: 'Functional Capacity Rating', returnToWorkDate: 'Return to Work Date',
  vitalCapacity: 'Vital Capacity (mL)', fev1Measurement: 'FEV1 Measurement (mL)', peakFlowRate: 'Peak Flow Rate (L/s)', respiratoryClearance: 'Respiratory Clearance',
  snellenVisualAcuity: 'Snellen Visual Acuity', colorVisionStatus: 'Color Vision Status', peripheralVisionFields: 'Peripheral Vision Fields', audiometryResults: 'Audiometry Results',
  stressTestResult: 'Stress Test Result', maximumOxygenUptake: 'Maximum Oxygen Uptake (VO2max)',
  gripStrengthMeasurement: 'Grip Strength (kg)', rangeOfMotionAssessment: 'Range of Motion Assessment', liftingCapacityTest: 'Lifting Capacity Test', balanceStabilityAssessment: 'Balance and Stability Assessment',
  psychologicalClearance: 'Psychological Clearance', substanceScreeningResults: 'Substance Screening Results', immunizationStatus: 'Immunization Status', dotPhysicalClassification: 'DOT Physical Classification', medicalRestrictions: 'Medical Restrictions',
  occupationalHealthRisk: 'Occupational Health Risk',
};
const DATE_FIELDS = ['returnToWorkDate'];
const BOOLEAN_FIELDS = ['psychologicalClearance', 'respiratoryClearance'];
const NUMBER_FIELDS = ['vitalCapacity', 'fev1Measurement', 'peakFlowRate', 'maximumOxygenUptake', 'gripStrengthMeasurement'];
const ENUM_FIELDS = ['physicalDemandsLevel', 'functionalCapacityRating'];
const ENUM_OPTIONS = { physicalDemandsLevel: ['Sedentary', 'Light', 'Medium', 'Heavy', 'Very Heavy'], functionalCapacityRating: ['Full', 'Modified', 'Restricted', 'Unable'] };
const enumCanonical = (options, val) => { const cur = String(val ?? '').trim(); const hit = (options || []).find(o => o.toLowerCase() === cur.toLowerCase()); return hit || cur; };
const ARRAY_FIELDS = ['medicalRestrictions'];
const COMMA_FIELDS = ['stressTestResult', 'substanceScreeningResults', 'immunizationStatus', 'snellenVisualAcuity', 'liftingCapacityTest'];

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  return true;
};
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
/* narrative → labeled sub-group (subLabel + numbered comma items) or numbered unlabeled row */
const sentenceRows = (text) => {
  const strip = (x) => String(x).replace(/[;.]+$/, '').trim();
  const sentences = splitBySentence(text);
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = parts.length >= 2 ? parts : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(strip(it)), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  let body;
  if (DATE_FIELDS.includes(f)) body = <Text style={styles.value}>1. {formatDate(val)}</Text>;
  else if (BOOLEAN_FIELDS.includes(f)) body = <Text style={styles.value}>1. {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : safeString(val)}</Text>;
  else if (NUMBER_FIELDS.includes(f)) body = <Text style={styles.value}>1. {safeString(val)}</Text>;
  else if (ENUM_FIELDS.includes(f)) body = <Text style={styles.value}>1. {safeString(enumCanonical(ENUM_OPTIONS[f], val))}</Text>;
  else if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : []).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    body = items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>);
  } else if (COMMA_FIELDS.includes(f)) {
    body = splitByComma(safeString(val)).map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {it}</Text>);
  } else {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle' ? <Text key={i} style={styles.subLabel}>{r.text}</Text> : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const FitnessForDutyEvaluationsDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].fitness_for_duty_evaluations && Array.isArray(docProp[0].fitness_for_duty_evaluations)) records = docProp[0].fitness_for_duty_evaluations;
    else records = docProp;
  } else if (docProp && docProp.fitness_for_duty_evaluations) {
    records = Array.isArray(docProp.fitness_for_duty_evaluations) ? docProp.fitness_for_duty_evaluations : [docProp.fitness_for_duty_evaluations];
  } else if (docProp && docProp.documentData) {
    const dd = docProp.documentData; records = Array.isArray(dd) ? dd : (dd?.fitness_for_duty_evaluations ? (Array.isArray(dd.fitness_for_duty_evaluations) ? dd.fitness_for_duty_evaluations : [dd.fitness_for_duty_evaluations]) : [dd]);
  } else if (docProp) records = [docProp];
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fitness For Duty Evaluations</Text></View>
        <Text style={styles.emptyState}>No fitness for duty evaluation data available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fitness For Duty Evaluations</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Fitness for Duty Evaluation ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasVal(record[f]));
              if (vis.length === 0) return null;
              return (
                <View key={sid} style={styles.section}>
                  {vis.flatMap((f, fi) => renderField(record, f, SECTION_TITLES[sid], fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FitnessForDutyEvaluationsDocumentPDFTemplate;
