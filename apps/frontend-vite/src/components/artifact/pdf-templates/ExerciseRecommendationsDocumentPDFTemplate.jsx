/**
 * ExerciseRecommendationsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors ExerciseRecommendationsDocument.jsx sections/labels
 * exactly (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: exercise_recommendations.
 * react-pdf: wrap is BOOLEAN only; each section glues its title to the first field so it never orphans.
 * Sentence fields split on [.;] + aggressive comma-split (labeled AND unlabeled) + numbered. Number
 * fields hide a stored 0 (= not measured / not prescribed sentinel) unless doctor-edited (mirror JSX
 * numberShows). Enums render canonical casing ('moderate' → 'Moderate'). Title / section title /
 * field label each get a borderBottom underline (no boxes).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.5 },
  listItem: { fontSize: 14, color: '#000000', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noData: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      const rest = text.slice(i + 1);
      const nextChar = rest.charAt(0);
      const restTrim = rest.replace(/^\s+/, '');
      if ((nextChar && /\d/.test(nextChar)) || /^(and|or|then)\b/i.test(restTrim) || /\b(and|or)$/i.test(current.trim())) {
        current += ch;
      } else {
        const t = current.trim(); if (t) result.push(t); current = '';
      }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* NUMBER fields where 0 is a "not measured / not prescribed" sentinel → hidden unless doctor-edited
   (mirror JSX numberShows; MEANINGFUL_ZERO_FIELDS is empty for this schema). */
const NUMBER_FIELDS = ['metabolicEquivalents', 'exerciseDurationMinutes', 'exerciseFrequencyWeekly', 'maximumOxygenUptake', 'warmUpDurationMinutes', 'coolDownDurationMinutes'];
const MEANINGFUL_ZERO_FIELDS = [];
const numberShows = (record, fn) => {
  const val = record?.[fn];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) {
    if (MEANINGFUL_ZERO_FIELDS.includes(fn)) return true;
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
  }
  return true;
};

/* Enum canonical casing (mirror JSX ENUM_OPTIONS/enumCanonical). */
const ENUM_OPTIONS = {
  exerciseIntensityLevel: ['Light', 'Moderate', 'Vigorous'],
  cardiacRiskStratification: ['Low', 'Moderate', 'High'],
  nyhaFunctionalClass: ['Class I', 'Class II', 'Class III', 'Class IV'],
  cardiacRehabilitationPhase: ['Phase I', 'Phase II', 'Phase III', 'Phase IV'],
  supervisionLevel: ['Medically Supervised', 'Supervised', 'Unsupervised'],
};
const enumCanonical = (fn, v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const hit = (ENUM_OPTIONS[fn] || []).find(o => o.toLowerCase() === s.toLowerCase());
  return hit || (s.charAt(0).toUpperCase() + s.slice(1));
};

/* buildRows: sentence → numbered rows (parseLabel sub-heading + aggressive comma-split). */
const buildRows = (items) => {
  const rows = []; let n = 1;
  items.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) { rows.push({ type: 'sub', text: safeString(parsed.label) }); parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 2) { parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    }
  });
  return rows;
};

const renderRowsBlock = (label, rows, key) => {
  if (rows.length === 0) return null;
  return (
    <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => row.type === 'sub'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'Exercise Parameters', fields: [
    { key: 'exerciseIntensityLevel', label: 'Exercise Intensity Level', type: 'enum' },
    { key: 'targetHeartRateZone', label: 'Target Heart Rate Zone' },
    { key: 'metabolicEquivalents', label: 'Metabolic Equivalents', type: 'number' },
    { key: 'exerciseDurationMinutes', label: 'Exercise Duration (Minutes)', type: 'number' },
    { key: 'exerciseFrequencyWeekly', label: 'Exercise Frequency (Weekly)', type: 'number' },
  ] },
  { title: 'Cardiac Assessment', fields: [
    { key: 'nyhaFunctionalClass', label: 'NYHA Functional Class', type: 'enum' },
    { key: 'cardiacRiskStratification', label: 'Cardiac Risk Stratification', type: 'enum' },
    { key: 'exerciseStressTestRequired', label: 'Exercise Stress Test Required', type: 'bool' },
    { key: 'maximumOxygenUptake', label: 'Maximum Oxygen Uptake', type: 'number' },
    { key: 'cardiacRehabilitationPhase', label: 'Cardiac Rehabilitation Phase', type: 'enum' },
  ] },
  { title: 'Limitations & Contraindications', fields: [
    { key: 'pulmonaryFunctionLimitations', label: 'Pulmonary Function Limitations', type: 'sentence' },
    { key: 'exerciseContraindications', label: 'Exercise Contraindications', type: 'array' },
    { key: 'orthopedicLimitations', label: 'Orthopedic Limitations', type: 'sentence' },
    { key: 'diabeticExerciseConsiderations', label: 'Diabetic Exercise Considerations', type: 'sentence' },
  ] },
  { title: 'Exercise Modalities', fields: [
    { key: 'exerciseModalitiesRecommended', label: 'Exercise Modalities Recommended', type: 'array' },
    { key: 'warmUpDurationMinutes', label: 'Warm-Up Duration (Minutes)', type: 'number' },
    { key: 'coolDownDurationMinutes', label: 'Cool-Down Duration (Minutes)', type: 'number' },
    { key: 'resistanceTrainingParameters', label: 'Resistance Training Parameters', type: 'sentence' },
    { key: 'exerciseProgressionTimeline', label: 'Exercise Progression Timeline', type: 'sentence' },
  ] },
  { title: 'Safety & Environmental', fields: [
    { key: 'bloodPressureTargets', label: 'Blood Pressure Targets', type: 'sentence' },
    { key: 'supervisionLevel', label: 'Supervision Level', type: 'enum' },
    { key: 'medicationTiming', label: 'Medication Timing', type: 'sentence' },
    { key: 'exerciseEnvironmentalFactors', label: 'Exercise Environmental Factors', type: 'sentence' },
    { key: 'borgRpeScale', label: 'Borg RPE Scale' },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (f.type === 'number') return numberShows(record, f.key);
  if (f.type === 'array') return Array.isArray(v) && v.filter(x => hasVal(x)).length > 0;
  return hasVal(v);
};

/* renderField: one wrap-glued View per field (label + value never split across a page). */
const renderField = (record, field, key) => {
  const val = record[field.key];
  if (field.type === 'sentence') return renderRowsBlock(field.label, buildRows(splitBySentence(fmtVal(val))), key);
  if (field.type === 'array') {
    const rows = (Array.isArray(val) ? val : []).filter(x => hasVal(x)).map((item, i) => ({ type: 'item', text: safeString(String(item)), num: i + 1 }));
    return renderRowsBlock(field.label, rows, key);
  }

  const display = field.type === 'enum' ? enumCanonical(field.key, val)
    : field.type === 'bool' ? (val ? 'Yes' : 'No')
    : safeString(fmtVal(val));
  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

const ExerciseRecommendationsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.exercise_recommendations) return Array.isArray(r.exercise_recommendations) ? r.exercise_recommendations : [r.exercise_recommendations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.exercise_recommendations) return Array.isArray(dd.exercise_recommendations) ? dd.exercise_recommendations : [dd.exercise_recommendations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Exercise Recommendations</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Exercise Recommendations</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>Exercise Recommendation {idx + 1}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const present = cfg.fields.filter(f => isPresent(record, f));
              if (present.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(record, present[0], 0)}
                  </View>
                  {present.slice(1).map((field, i) => renderField(record, field, i + 1))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default ExerciseRecommendationsDocumentPDFTemplate;
