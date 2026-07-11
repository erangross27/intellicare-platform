/**
 * PreeclampsiaMonitoringDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — preeclampsia monitoring
 * Collection: preeclampsia_monitoring
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return new Date(val.$date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return String(val);
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

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'vitals': 'Vitals & Gestational Age',
  'lab-results': 'Laboratory Results',
  'fetal-assessment': 'Fetal Assessment',
  'symptoms': 'Symptoms',
  'clinical-status': 'Clinical Status & Management',
};

const FIELD_LABELS = {
  systolicBloodPressure: 'Systolic Blood Pressure (mmHg)',
  diastolicBloodPressure: 'Diastolic Blood Pressure (mmHg)',
  gestationalAge: 'Gestational Age (weeks)',
  proteinuria24Hour: '24-Hour Proteinuria (mg)',
  proteinCreatinineRatio: 'Protein:Creatinine Ratio',
  dipstickProteinuria: 'Dipstick Proteinuria',
  serumCreatinine: 'Serum Creatinine (mg/dL)',
  plateletCount: 'Platelet Count (x10³/µL)',
  altLevel: 'ALT Level (U/L)',
  astLevel: 'AST Level (U/L)',
  ldhLevel: 'LDH Level (U/L)',
  serumAlbumin: 'Serum Albumin (g/dL)',
  uricAcidLevel: 'Uric Acid Level (mg/dL)',
  fetalWeightPercentile: 'Fetal Weight Percentile',
  umbilicalArteryDoppler: 'Umbilical Artery Doppler',
  middleCerebralArteryDoppler: 'Middle Cerebral Artery Doppler',
  amnioticFluidVolume: 'Amniotic Fluid Volume',
  visualDisturbances: 'Visual Disturbances',
  severeHeadache: 'Severe Headache',
  epigastricPain: 'Epigastric Pain',
  preeclampsiaWithSevereFeatures: 'Preeclampsia With Severe Features',
  hellpSyndrome: 'HELLP Syndrome',
  magnesiumSulfateAdministration: 'Magnesium Sulfate Administration',
  antihypertensiveMedication: 'Antihypertensive Medication',
};

const SECTION_FIELDS = {
  'vitals': ['systolicBloodPressure', 'diastolicBloodPressure', 'gestationalAge'],
  'lab-results': ['proteinuria24Hour', 'proteinCreatinineRatio', 'dipstickProteinuria', 'serumCreatinine', 'plateletCount', 'altLevel', 'astLevel', 'ldhLevel', 'serumAlbumin', 'uricAcidLevel'],
  'fetal-assessment': ['fetalWeightPercentile', 'umbilicalArteryDoppler', 'middleCerebralArteryDoppler', 'amnioticFluidVolume'],
  'symptoms': ['visualDisturbances', 'severeHeadache', 'epigastricPain'],
  'clinical-status': ['preeclampsiaWithSevereFeatures', 'hellpSyndrome', 'magnesiumSulfateAdministration', 'antihypertensiveMedication'],
};

/* ======= RENDER FIELD ======= */
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  return (
    <View key={fn} style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(val)}</Text>
    </View>
  );
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]));
  if (presentFields.length === 0) return null;
  return (
    <View key={sid} style={styles.fieldBox} wrap={presentFields.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {presentFields.map(f => renderField(record, f, title))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const PreeclampsiaMonitoringDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].preeclampsia_monitoring && Array.isArray(docProp[0].preeclampsia_monitoring)) {
      records = docProp[0].preeclampsia_monitoring;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.preeclampsia_monitoring) {
    records = Array.isArray(docProp.preeclampsia_monitoring) ? docProp.preeclampsia_monitoring : [docProp.preeclampsia_monitoring];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Preeclampsia Monitoring</Text>
          </View>
          <Text style={styles.noDataText}>No preeclampsia monitoring data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Preeclampsia Monitoring</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              {hasVal(record.gestationalAge) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>GA: {String(record.gestationalAge)} weeks</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>{`Preeclampsia Monitoring ${idx + 1}`}</Text>
            </View>
            {renderSection(record, 'vitals')}
            {renderSection(record, 'lab-results')}
            {renderSection(record, 'fetal-assessment')}
            {renderSection(record, 'symptoms')}
            {renderSection(record, 'clinical-status')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PreeclampsiaMonitoringDocumentPDFTemplate;
