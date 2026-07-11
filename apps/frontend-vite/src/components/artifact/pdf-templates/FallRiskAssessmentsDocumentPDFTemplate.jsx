/**
 * FallRiskAssessmentsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors FallRiskAssessmentsDocument.jsx sections/labels
 * exactly (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: fall_risk_assessments.
 * react-pdf: wrap is BOOLEAN only; each section glues its title to the first field so it never orphans.
 * Sentinel-0 scores hidden (Beatrice proof: Morse 80 real alongside 7 zeroed scales; FES-I min is 7)
 * EXCEPT previousFallsHistory (0 falls = REAL count). Enums (assistive device, ADL dependency,
 * risk category Low/Moderate/High) render canonical casing. NO date in this schema — record header
 * is the numbered title only. Title / section title / field label get borderBottom underlines.
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

/* Sentinel-0 scores hidden (mirror JSX ZERO_SENTINEL_FIELDS); previousFallsHistory 0 = REAL count. */
const ZERO_SENTINEL_FIELDS = ['morseScaleScore', 'hendrichFallRiskScore', 'stratifyScore', 'tingettiScore', 'bergBalanceScore', 'timedUpAndGoTest', 'functionalReachTest', 'cognitiveMmseScore', 'fearOfFallingScale'];
const numberShows = (record, fn) => {
  const val = record?.[fn];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0 && ZERO_SENTINEL_FIELDS.includes(fn)) {
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
  }
  return true;
};

/* Enum canonical casing (mirror JSX ENUM_OPTIONS/enumCanonical). */
const ENUM_OPTIONS = {
  assistiveDeviceUsed: ['None', 'Cane', 'Quad Cane', 'Walker', 'Rollator', 'Wheelchair', 'Crutches'],
  adlDependencyLevel: ['Independent', 'Partially Dependent', 'Dependent'],
  overallRiskCategory: ['Low Risk', 'Moderate Risk', 'High Risk'],
};
const enumCanonical = (fn, v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const hit = (ENUM_OPTIONS[fn] || []).find(o => o.toLowerCase() === s.toLowerCase());
  return hit || (s.charAt(0).toUpperCase() + s.slice(1));
};

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'Standardized Risk Scores', fields: [
    { key: 'morseScaleScore', label: 'Morse Scale Score', type: 'number' },
    { key: 'hendrichFallRiskScore', label: 'Hendrich Fall Risk Score', type: 'number' },
    { key: 'stratifyScore', label: 'STRATIFY Score', type: 'number' },
    { key: 'tingettiScore', label: 'Tinetti Score', type: 'number' },
    { key: 'bergBalanceScore', label: 'Berg Balance Score', type: 'number' },
  ] },
  { title: 'Functional Tests', fields: [
    { key: 'timedUpAndGoTest', label: 'Timed Up and Go Test', type: 'number' },
    { key: 'functionalReachTest', label: 'Functional Reach Test', type: 'number' },
    { key: 'previousFallsHistory', label: 'Previous Falls History', type: 'number' },
  ] },
  { title: 'Medical Factors', fields: [
    { key: 'orthostasisPresent', label: 'Orthostasis Present', type: 'bool' },
    { key: 'medicationRiskFactors', label: 'Medication Risk Factors', type: 'array' },
    { key: 'cognitiveMmseScore', label: 'Cognitive MMSE Score', type: 'number' },
  ] },
  { title: 'Sensory Status', fields: [
    { key: 'visualAcuityImpairment', label: 'Visual Acuity Impairment', type: 'bool' },
    { key: 'hearingImpairmentPresent', label: 'Hearing Impairment Present', type: 'bool' },
  ] },
  { title: 'Mobility Assessment', fields: [
    { key: 'gaitAbnormalities', label: 'Gait Abnormalities', type: 'array' },
    { key: 'assistiveDeviceUsed', label: 'Assistive Device Used', type: 'enum' },
    { key: 'muscleWeaknessSites', label: 'Muscle Weakness Sites', type: 'array' },
    { key: 'jointMobilityLimitations', label: 'Joint Mobility Limitations', type: 'array' },
    { key: 'footProblemsPresent', label: 'Foot Problems Present', type: 'bool' },
  ] },
  { title: 'Environmental & ADL', fields: [
    { key: 'environmentalHazards', label: 'Environmental Hazards', type: 'array' },
    { key: 'adlDependencyLevel', label: 'ADL Dependency Level', type: 'enum' },
    { key: 'incontinencePresent', label: 'Incontinence Present', type: 'bool' },
  ] },
  { title: 'Overall Risk', fields: [
    { key: 'fearOfFallingScale', label: 'Fear of Falling Scale', type: 'number' },
    { key: 'overallRiskCategory', label: 'Overall Risk Category', type: 'enum' },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (f.type === 'number') return numberShows(record, f.key);
  if (f.type === 'bool') return typeof v === 'boolean';
  if (f.type === 'array') return Array.isArray(v) && v.filter(Boolean).length > 0;
  return hasVal(v);
};

/* renderField: one wrap-glued View per field (label + value never split across a page). */
const renderField = (record, field, key) => {
  const val = record[field.key];
  if (field.type === 'array') {
    const rows = (Array.isArray(val) ? val : []).filter(Boolean).map((t, i) => ({ text: safeString(String(t)), num: i + 1 }));
    if (rows.length === 0) return null;
    return (
      <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        {rows.map((row, i) => <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
      </View>
    );
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

const FallRiskAssessmentsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.fall_risk_assessments) return Array.isArray(r.fall_risk_assessments) ? r.fall_risk_assessments : [r.fall_risk_assessments];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.fall_risk_assessments) return Array.isArray(dd.fall_risk_assessments) ? dd.fall_risk_assessments : [dd.fall_risk_assessments]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Fall Risk Assessments</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Fall Risk Assessments</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            {/* NO date in this schema — record header is ONLY the numbered record title */}
            <Text style={styles.recordTitle}>Fall Risk Assessment {idx + 1}</Text>
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

export default FallRiskAssessmentsDocumentPDFTemplate;
