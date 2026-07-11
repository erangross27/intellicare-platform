/**
 * ExercisePrescriptionDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors ExercisePrescriptionDocument.jsx sections/labels
 * exactly (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: exercise_prescription.
 * react-pdf: wrap is BOOLEAN only; each section is one wrap-glued View so its title never orphans.
 * Sentence fields (progressionCriteria/exerciseFrequency/sessionDuration) split on [.;] + aggressive
 * comma-split + numbered; functionalMovementScore hides a stored 0 (= not assessed, FMS is 0–21).
 * Title/section/label each get a borderBottom underline (no boxes).
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

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

/* Functional Movement Screen is 0–21; a stored 0 = "not assessed" → hidden (mirror JSX). */
const ZERO_SENTINEL = ['functionalMovementScore'];

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'Prescription Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'prescribingPhysician', label: 'Prescribing Physician' },
    { key: 'primaryDiagnosis', label: 'Primary Diagnosis' },
    { key: 'secondaryDiagnoses', label: 'Secondary Diagnoses', type: 'array' },
    { key: 'functionalLimitations', label: 'Functional Limitations', type: 'array' },
    { key: 'baselineFitnessLevel', label: 'Baseline Fitness Level' },
  ] },
  { title: 'Exercise Goals', fields: [
    { key: 'exerciseGoals', label: 'Exercise Goals', type: 'array' },
  ] },
  { title: 'Exercise Parameters', fields: [
    { key: 'targetHeartRateRange', label: 'Target Heart Rate Range' },
    { key: 'exerciseFrequency', label: 'Exercise Frequency', type: 'sentence' },
    { key: 'sessionDuration', label: 'Session Duration', type: 'sentence' },
    { key: 'exerciseIntensity', label: 'Exercise Intensity' },
  ] },
  { title: 'Specific Exercises', fields: [
    { key: 'specificExercises', label: 'Specific Exercises', type: 'array' },
  ] },
  { title: 'Safety & Protocols', fields: [
    { key: 'warmUpProtocol', label: 'Warm-Up Protocol' },
    { key: 'coolDownProtocol', label: 'Cool-Down Protocol' },
    { key: 'painThresholdGuidance', label: 'Pain Threshold Guidance' },
    { key: 'progressionCriteria', label: 'Progression Criteria', type: 'sentence' },
    { key: 'contraindications', label: 'Contraindications', type: 'array' },
    { key: 'modificationOptions', label: 'Modification Options', type: 'array' },
  ] },
  { title: 'Equipment & Supervision', fields: [
    { key: 'equipmentRequired', label: 'Equipment Required', type: 'array' },
    { key: 'supervisionLevel', label: 'Supervision Level' },
  ] },
  { title: 'Clearance & Scoring', fields: [
    { key: 'cardiacClearanceObtained', label: 'Cardiac Clearance Obtained', type: 'bool' },
    { key: 'homeExerciseProgramIncluded', label: 'Home Exercise Program Included', type: 'bool' },
    { key: 'functionalMovementScore', label: 'Functional Movement Score', type: 'number', zeroSentinel: true },
    { key: 'educationalMaterialsProvided', label: 'Educational Materials Provided', type: 'array' },
  ] },
  { title: 'Reevaluation', fields: [
    { key: 'reevaluationDate', label: 'Reevaluation Date', type: 'date' },
    { key: 'returnToPlayCriteria', label: 'Return to Play Criteria', type: 'array' },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (f.type === 'array') return Array.isArray(v) && v.filter(Boolean).length > 0;
  if (f.type === 'number') return hasVal(v) && !((f.zeroSentinel || ZERO_SENTINEL.includes(f.key)) && Number(v) === 0);
  return hasVal(v);
};

/* buildRows: sentence/array → numbered rows (parseLabel sub-heading + aggressive comma-split). */
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

/* renderField: one wrap-glued View per field (label + value never split across a page). */
const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  const showLabel = (field.label || '').toLowerCase() !== (sectionTitle || '').toLowerCase();
  if (field.type === 'sentence') return renderRowsBlock(field.label, buildRows(splitBySentence(fmtVal(val))), key);
  if (field.type === 'array') return renderRowsBlock(field.label, buildRows((Array.isArray(val) ? val : []).filter(Boolean).map(String)), key);

  const display = field.type === 'date' ? formatDate(val) : field.type === 'bool' ? (val ? 'Yes' : 'No') : safeString(fmtVal(val));
  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

const ExercisePrescriptionDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.exercise_prescription) return Array.isArray(r.exercise_prescription) ? r.exercise_prescription : [r.exercise_prescription];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.exercise_prescription) return Array.isArray(dd.exercise_prescription) ? dd.exercise_prescription : [dd.exercise_prescription]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Exercise Prescription</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Exercise Prescription</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>Exercise Prescription {idx + 1}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const present = cfg.fields.filter(f => isPresent(record, f));
              if (present.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(record, present[0], cfg.title, 0)}
                  </View>
                  {present.slice(1).map((field, i) => renderField(record, field, cfg.title, i + 1))}
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

export default ExercisePrescriptionDocumentPDFTemplate;
