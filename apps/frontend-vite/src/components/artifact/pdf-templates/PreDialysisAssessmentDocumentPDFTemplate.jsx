/**
 * PreDialysisAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER size — pre-dialysis assessment
 * Collection: pre_dialysis_assessment
 * Record has no clinical date field (only createdAt/updatedAt ingestion timestamps) → no date rendered.
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
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
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

const FIELD_UNITS = {
  estimatedGFR: ' mL/min',
  serumCreatinine: ' mg/dL',
  bloodUreaNitrogen: ' mg/dL',
  creatinineClearance: ' mL/min',
  proteinuria: ' mg/dL',
  albuminuria: ' mg/dL',
  hemoglobin: ' g/dL',
  hematocrit: '%',
  serumPhosphorus: ' mg/dL',
  serumCalcium: ' mg/dL',
  parathyroidHormone: ' pg/mL',
  vitaminD25OH: ' ng/mL',
  serum25OHD3: ' ng/mL',
  alkalinePhosphatase: ' U/L',
  serumBicarbonate: ' mEq/L',
  echocardiogramEF: '%',
};

/* Every number here is a renal lab/measure that can never legitimately read exactly 0 →
   a stored 0 is an AI-extractor "not measured" sentinel → hide it (mirrors the JSX). */
const NUMBER_KEYS = ['estimatedGFR', 'serumCreatinine', 'bloodUreaNitrogen', 'creatinineClearance', 'proteinuria', 'albuminuria', 'hemoglobin', 'hematocrit', 'serumPhosphorus', 'serumCalcium', 'parathyroidHormone', 'vitaminD25OH', 'serum25OHD3', 'alkalinePhosphatase', 'serumBicarbonate', 'echocardiogramEF'];
const isMeaninglessZero = (fn, v) => NUMBER_KEYS.includes(fn) && (v === 0 || v === '0');

const formatDisplayValuePDF = (fn, val) => {
  if (fn === 'ckdStage') return `Stage ${safeString(val)}`;
  const unit = FIELD_UNITS[fn];
  if (unit) return `${safeString(fmtVal(val))}${unit}`;
  return safeString(fmtVal(val));
};

const fieldVisible = (record, field) => hasVal(record[field.key]) && !isMeaninglessZero(field.key, record[field.key]);

/* renderField: bare underlined label + value inside a fieldBox */
const renderField = (record, field) => {
  if (!fieldVisible(record, field)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <Text style={styles.fieldValue}>{formatDisplayValuePDF(field.key, record[field.key])}</Text>
    </View>
  );
};

/* SECTION CONFIGS — 7 sections (no provider-details / no date; record has no clinical date field) */
const SECTION_CONFIGS = [
  {
    title: 'Kidney Function',
    fields: [
      { key: 'estimatedGFR', label: 'Estimated GFR' },
      { key: 'ckdStage', label: 'CKD Stage' },
      { key: 'serumCreatinine', label: 'Serum Creatinine' },
      { key: 'bloodUreaNitrogen', label: 'Blood Urea Nitrogen' },
      { key: 'creatinineClearance', label: 'Creatinine Clearance' },
      { key: 'proteinuria', label: 'Proteinuria' },
      { key: 'albuminuria', label: 'Albuminuria' },
    ],
  },
  {
    title: 'Hematology',
    fields: [
      { key: 'hemoglobin', label: 'Hemoglobin' },
      { key: 'hematocrit', label: 'Hematocrit' },
    ],
  },
  {
    title: 'Bone & Mineral Metabolism',
    fields: [
      { key: 'serumPhosphorus', label: 'Serum Phosphorus' },
      { key: 'serumCalcium', label: 'Serum Calcium' },
      { key: 'parathyroidHormone', label: 'Parathyroid Hormone' },
      { key: 'vitaminD25OH', label: 'Vitamin D 25-OH' },
      { key: 'serum25OHD3', label: 'Serum 25-OH-D3' },
      { key: 'alkalinePhosphatase', label: 'Alkaline Phosphatase' },
    ],
  },
  {
    title: 'Acid-Base Status',
    fields: [
      { key: 'acidosis', label: 'Acidosis' },
      { key: 'serumBicarbonate', label: 'Serum Bicarbonate' },
    ],
  },
  {
    title: 'Vascular Access',
    fields: [
      { key: 'vascularAccessType', label: 'Vascular Access Type' },
      { key: 'vascularAccessMaturation', label: 'Vascular Access Maturation' },
    ],
  },
  {
    title: 'Cardiovascular',
    fields: [
      { key: 'fluidOverload', label: 'Fluid Overload' },
      { key: 'nyhaClass', label: 'NYHA Class' },
      { key: 'echocardiogramEF', label: 'Echocardiogram EF' },
    ],
  },
  {
    title: 'Infectious Disease Screening',
    fields: [
      { key: 'hepatitisBsAg', label: 'Hepatitis B sAg' },
      { key: 'hepatitisCantibody', label: 'Hepatitis C Antibody' },
      { key: 'hivStatus', label: 'HIV Status' },
    ],
  },
];

/* renderSection: anti-orphan glue — section title + first visible field ride together in a
   wrap={false} View so a title never orphans at a page break; remaining fields flow after. */
const renderSection = (sectionConfig, record, sIdx) => {
  const elements = sectionConfig.fields.map(f => renderField(record, f)).filter(Boolean);
  if (!elements.length) return null;
  const [first, ...rest] = elements;
  return (
    <View key={sIdx} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
        {first}
      </View>
      {rest.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </View>
  );
};

/* ======= COMPONENT ======= */
const PreDialysisAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.pre_dialysis_assessment) return Array.isArray(r.pre_dialysis_assessment) ? r.pre_dialysis_assessment : [r.pre_dialysis_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pre_dialysis_assessment) return Array.isArray(dd.pre_dialysis_assessment) ? dd.pre_dialysis_assessment : [dd.pre_dialysis_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pre-Dialysis Assessment</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pre-Dialysis Assessment</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Pre-Dialysis Assessment Record {index + 1}</Text>
            </View>

            {SECTION_CONFIGS.map((sectionConfig, sIdx) => renderSection(sectionConfig, record, sIdx))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PreDialysisAssessmentDocumentPDFTemplate;
