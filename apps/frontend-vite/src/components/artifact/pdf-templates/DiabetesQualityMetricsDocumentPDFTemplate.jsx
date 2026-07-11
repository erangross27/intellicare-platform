/**
 * DiabetesQualityMetricsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: diabetes_quality_metrics.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only; each field is its own glue unit; the section title rides
 * inside the first. Every value row numbered ("1." even singles). Mirrors the JSX exactly:
 * date field inside Provider Information, HbA1c/LDL display suffixes (% / mg/dL),
 * sentinel zeros hidden (A1c/LDL/BMI 0 are extractor defaults).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    if (d.getUTCFullYear() <= 1970) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

/* mirrors the JSX field semantics */
const DATE_FIELDS = ['date', 'hemoglobinA1cDate', 'albuminuriaScreeningDate', 'dilatedEyeExamDate', 'footExaminationDate', 'influenzaVaccinationDate', 'pneumococcalVaccinationDate'];
const NUMBER_FIELDS = ['hemoglobinA1cValue', 'ldlCholesterolValue', 'bmiValue'];
const fieldShows = (fn, v) => hasVal(v) && !(typeof v === 'number' && v === 0 && NUMBER_FIELDS.includes(fn));
const displayFieldValue = (fn, val) => {
  if (DATE_FIELDS.includes(fn)) return formatDate(val);
  if (fn === 'hemoglobinA1cValue' && hasVal(val)) return `${fmtVal(val)}%`;
  if (fn === 'ldlCholesterolValue' && hasVal(val)) return `${fmtVal(val)} mg/dL`;
  return fmtVal(val);
};

const SECTIONS = [
  ['Provider Information', [['date', 'Date'], ['provider', 'Provider'], ['facility', 'Facility']]],
  ['Glycemic Control', [['hemoglobinA1cValue', 'HbA1c Value'], ['hemoglobinA1cDate', 'HbA1c Date'], ['hemoglobinA1cControlled', 'HbA1c Controlled']]],
  ['Cardiovascular Risk', [['bloodPressureValue', 'Blood Pressure'], ['bloodPressureControlled', 'BP Controlled'], ['ldlCholesterolValue', 'LDL Cholesterol'], ['ldlCholesterolControlled', 'LDL Controlled'], ['bmiValue', 'BMI']]],
  ['Kidney Screening', [['albuminuriaScreeningDate', 'Screening Date'], ['albuminuriaScreeningResult', 'Result']]],
  ['Eye Examination', [['dilatedEyeExamDate', 'Dilated Eye Exam Date'], ['diabeticRetinopathyPresent', 'Diabetic Retinopathy']]],
  ['Foot Examination', [['footExaminationDate', 'Foot Exam Date'], ['peripheralNeuropathyPresent', 'Peripheral Neuropathy']]],
  ['Medications', [['statinTherapyPrescribed', 'Statin Therapy'], ['aceInhibitorOrArbPrescribed', 'ACE Inhibitor/ARB'], ['aspirinTherapyIndicated', 'Aspirin Therapy']]],
  ['Lifestyle & Education', [['diabetesEducationCompleted', 'Diabetes Education'], ['smokingStatus', 'Smoking Status'], ['tobaccoCessationCounseling', 'Tobacco Cessation Counseling']]],
  ['Vaccinations', [['influenzaVaccinationDate', 'Influenza Vaccination'], ['pneumococcalVaccinationDate', 'Pneumococcal Vaccination']]],
];

/* ═══ COMPONENT ═══ */
const DiabetesQualityMetricsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.diabetes_quality_metrics) return Array.isArray(r.diabetes_quality_metrics) ? r.diabetes_quality_metrics : [r.diabetes_quality_metrics];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_quality_metrics) return Array.isArray(dd.diabetes_quality_metrics) ? dd.diabetes_quality_metrics : [dd.diabetes_quality_metrics]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Diabetes Quality Metrics">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Quality Metrics</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document title="Diabetes Quality Metrics">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Quality Metrics</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Diabetes Quality Metrics ${idx + 1}`}</Text>
            </View>

            {SECTIONS.map(([title, spec]) => {
              const shown = spec.filter(([f]) => fieldShows(f, record[f]) && displayFieldValue(f, record[f]));
              if (shown.length === 0) return null;
              return (
                <View key={title} style={styles.section}>
                  {shown.map(([f, label], fi) => (
                    <View key={f} style={styles.fieldGroup} wrap={false}>
                      {fi === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
                      <Text style={styles.fieldLabel}>{safeString(label)}</Text>
                      <Text style={styles.value}>{`1. ${safeString(displayFieldValue(f, record[f]))}`}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DiabetesQualityMetricsDocumentPDFTemplate;
