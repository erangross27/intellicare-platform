import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * EndocrinologyConsultationsDocumentPDFTemplate
 * July 2026 — box-free B&W one-pass rewrite (mirrors the JSX 4-area canonical view).
 * FLAT NUMERIC LAB PANEL: 24 analyte number fields + 1 enum (diabeticRetinopathyGrade).
 * Whole-panel zero-sentinel: every off-panel analyte defaults to 0 → HIDE 0 on all numbers.
 */

const styles = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', paddingVertical: 44, paddingHorizontal: 48, fontFamily: 'Helvetica', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 14 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  firstFieldWrap: { marginBottom: 9 },
  field: { marginBottom: 9 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.4 },
  emptyText: { fontSize: 14, color: '#333333' },
});

const FIELD_LABELS = {
  hemoglobinA1c: 'Hemoglobin A1c (%)',
  fastingPlasmaGlucose: 'Fasting Plasma Glucose (mg/dL)',
  oralGlucoseToleranceTest: 'Oral Glucose Tolerance Test (mg/dL)',
  thyroidStimulatingHormone: 'TSH (mIU/L)',
  freeThyroxineT4: 'Free Thyroxine T4 (ng/dL)',
  freeTriiodothyronineT3: 'Free Triiodothyronine T3 (pg/mL)',
  thyroglobulinAntibody: 'Thyroglobulin Antibody (IU/mL)',
  thyroidPeroxidaseAntibody: 'Thyroid Peroxidase Antibody (IU/mL)',
  serumCortisol: 'Serum Cortisol (mcg/dL)',
  dexamethasoneSuppressionTest: 'Dexamethasone Suppression Test (mcg/dL)',
  acthStimulationTest: 'ACTH Stimulation Test (mcg/dL)',
  parathyroidHormone: 'Parathyroid Hormone (pg/mL)',
  vitamin25Hydroxy: 'Vitamin D 25-Hydroxy (ng/mL)',
  ionizedCalcium: 'Ionized Calcium (mg/dL)',
  insulinLevel: 'Insulin Level (mcIU/mL)',
  cPeptide: 'C-Peptide (ng/mL)',
  homaIrIndex: 'HOMA-IR Index',
  growthHormoneLevelBaseline: 'Growth Hormone Baseline (ng/mL)',
  igf1Level: 'IGF-1 Level (ng/mL)',
  prolactinLevel: 'Prolactin Level (ng/mL)',
  totalTestosterone: 'Total Testosterone (ng/dL)',
  freeTestosterone: 'Free Testosterone (pg/mL)',
  dheasLevel: 'DHEA-S Level (mcg/dL)',
  microalbuminuria: 'Microalbuminuria (mg/L)',
  diabeticRetinopathyGrade: 'Diabetic Retinopathy Grade',
};

const SECTION_ORDER = [
  ['Glycemic Panel', ['hemoglobinA1c', 'fastingPlasmaGlucose', 'oralGlucoseToleranceTest']],
  ['Thyroid Panel', ['thyroidStimulatingHormone', 'freeThyroxineT4', 'freeTriiodothyronineT3', 'thyroglobulinAntibody', 'thyroidPeroxidaseAntibody']],
  ['Adrenal & Bone Panel', ['serumCortisol', 'dexamethasoneSuppressionTest', 'acthStimulationTest', 'parathyroidHormone', 'vitamin25Hydroxy', 'ionizedCalcium']],
  ['Metabolic & Hormone Panel', ['insulinLevel', 'cPeptide', 'homaIrIndex', 'growthHormoneLevelBaseline', 'igf1Level', 'prolactinLevel', 'totalTestosterone', 'freeTestosterone', 'dheasLevel']],
  ['Complications', ['microalbuminuria', 'diabeticRetinopathyGrade']],
];

const NUMBER_FIELDS = [
  'hemoglobinA1c', 'fastingPlasmaGlucose', 'oralGlucoseToleranceTest',
  'thyroidStimulatingHormone', 'freeThyroxineT4', 'freeTriiodothyronineT3',
  'thyroglobulinAntibody', 'thyroidPeroxidaseAntibody',
  'serumCortisol', 'dexamethasoneSuppressionTest', 'acthStimulationTest',
  'parathyroidHormone', 'vitamin25Hydroxy', 'ionizedCalcium',
  'insulinLevel', 'cPeptide', 'homaIrIndex', 'growthHormoneLevelBaseline',
  'igf1Level', 'prolactinLevel', 'totalTestosterone', 'freeTestosterone',
  'dheasLevel', 'microalbuminuria',
];

const ENUM_FIELDS = ['diabeticRetinopathyGrade'];
const ENUM_OPTIONS = { diabeticRetinopathyGrade: ['None', 'Mild', 'Moderate', 'Severe', 'Proliferative'] };
const enumCanonical = (options, current) => { const cur = String(current ?? '').trim(); return options.find(o => o.toLowerCase() === cur.toLowerCase()) || cur; };

/* WHOLE-PANEL ZERO-SENTINEL: hide 0 on every number field (no endocrine analyte reads exactly 0). */
const isZeroSentinel = (fn, v) => NUMBER_FIELDS.includes(fn) && Number(v) === 0;
const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'string') return val.trim() !== '';
  return true;
};
const fieldPresent = (record, fn) => { const v = record[fn]; return hasValue(v) && !isZeroSentinel(fn, v); };
const dispValue = (record, fn) => {
  const v = record[fn];
  return ENUM_FIELDS.includes(fn) ? enumCanonical(ENUM_OPTIONS[fn] || [], v) : String(v);
};

const EndocrinologyConsultationsDocumentPDFTemplate = ({ document: doc }) => {
  let records = [];
  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc?.endocrinology_consultations && Array.isArray(doc.endocrinology_consultations)) {
    records = doc.endocrinology_consultations;
  } else if (doc?.documentData) {
    const docData = doc.documentData;
    if (Array.isArray(docData)) records = docData;
    else if (docData?.endocrinology_consultations) records = docData.endocrinology_consultations;
    else if (docData && typeof docData === 'object') records = [docData];
  } else if (doc && typeof doc === 'object') {
    records = [doc];
  }
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Endocrinology Consultations</Text>
          <Text style={styles.emptyText}>No endocrinology consultation data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Endocrinology Consultations</Text>

        {/* Flatten record children DIRECTLY under <Page> — a per-record wrapper <View> becomes a
            keep-together unit that react-pdf shoves WHOLE to the next page when it doesn't fit the
            post-title remainder (page 1 = title only). break={idx>0} on the record title (a direct
            Page child) still starts each record on its own page. (memory 6a4a145f / Rule #74) */}
        {records.flatMap((record, idx) => {
          const els = [<Text key={`rt-${idx}`} style={styles.recordTitle} break={idx > 0}>Endocrinology Consultation {idx + 1}</Text>];
          SECTION_ORDER.forEach(([title, fields]) => {
            const present = fields.filter(f => fieldPresent(record, f));
            if (present.length === 0) return;
            els.push(
              <View key={`${idx}-${title}`} style={styles.section}>
                {present.map((f, i) => (
                  <View key={f} wrap={false} style={i === 0 ? styles.firstFieldWrap : styles.field}>
                    {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
                    <Text style={styles.fieldLabel}>{FIELD_LABELS[f] || f}</Text>
                    <Text style={styles.fieldValue}>1. {dispValue(record, f)}</Text>
                  </View>
                ))}
              </View>
            );
          });
          return els;
        })}
      </Page>
    </Document>
  );
};

export default EndocrinologyConsultationsDocumentPDFTemplate;
