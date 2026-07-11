/**
 * RetinalExaminationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — retinal examinations
 * Collection: retinal_examinations
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
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'visual-acuity': 'Visual Acuity',
  'intraocular-pressure': 'Intraocular Pressure',
  'pupil-response': 'Pupil Response',
  'cup-disc-ratio': 'Cup-to-Disc Ratio',
  'macular-appearance': 'Macular Appearance',
  'retinal-vascular-changes': 'Retinal Vascular Changes',
  'diabetic-retinopathy': 'Diabetic & Hypertensive Retinopathy',
  'oct': 'Optical Coherence Tomography',
  'imaging': 'Imaging Studies',
  'peripheral-vitreous': 'Peripheral Retina & Vitreous',
  'amsler-grid': 'Amsler Grid & Retinoschisis',
};

const FIELD_LABELS = {
  visualAcuityOD: 'Visual Acuity OD (Right Eye)',
  visualAcuityOS: 'Visual Acuity OS (Left Eye)',
  intraocularPressureOD: 'IOP OD (Right Eye)',
  intraocularPressureOS: 'IOP OS (Left Eye)',
  pupilResponseOD: 'Pupil Response OD (Right Eye)',
  pupilResponseOS: 'Pupil Response OS (Left Eye)',
  cupDiscRatioOD: 'Cup-to-Disc Ratio OD (Right Eye)',
  cupDiscRatioOS: 'Cup-to-Disc Ratio OS (Left Eye)',
  macularAppearanceOD: 'Macular Appearance OD (Right Eye)',
  macularAppearanceOS: 'Macular Appearance OS (Left Eye)',
  retinalVascularChangesOD: 'Vascular Changes OD (Right Eye)',
  retinalVascularChangesOS: 'Vascular Changes OS (Left Eye)',
  diabeticRetinopathyGradeOD: 'Diabetic Retinopathy Grade OD',
  diabeticRetinopathyGradeOS: 'Diabetic Retinopathy Grade OS',
  hypertensiveRetinopathyGradeOD: 'Hypertensive Retinopathy Grade OD',
  hypertensiveRetinopathyGradeOS: 'Hypertensive Retinopathy Grade OS',
  opticalCoherenceTomographyOD: 'OCT OD (Right Eye)',
  opticalCoherenceTomographyOS: 'OCT OS (Left Eye)',
  fundusPhotographyPerformed: 'Fundus Photography Performed',
  fluoresceinAngiographyFindings: 'Fluorescein Angiography Findings',
  peripheralRetinalExaminationOD: 'Peripheral Retina OD (Right Eye)',
  peripheralRetinalExaminationOS: 'Peripheral Retina OS (Left Eye)',
  vitreousExaminationOD: 'Vitreous OD (Right Eye)',
  vitreousExaminationOS: 'Vitreous OS (Left Eye)',
  amslerGridTestOD: 'Amsler Grid OD (Right Eye)',
  amslerGridTestOS: 'Amsler Grid OS (Left Eye)',
  retinoschisisseverity: 'Retinoschisis Severity',
};

const SECTION_FIELDS = {
  'visual-acuity': ['visualAcuityOD', 'visualAcuityOS'],
  'intraocular-pressure': ['intraocularPressureOD', 'intraocularPressureOS'],
  'pupil-response': ['pupilResponseOD', 'pupilResponseOS'],
  'cup-disc-ratio': ['cupDiscRatioOD', 'cupDiscRatioOS'],
  'macular-appearance': ['macularAppearanceOD', 'macularAppearanceOS'],
  'retinal-vascular-changes': ['retinalVascularChangesOD', 'retinalVascularChangesOS'],
  'diabetic-retinopathy': ['diabeticRetinopathyGradeOD', 'diabeticRetinopathyGradeOS', 'hypertensiveRetinopathyGradeOD', 'hypertensiveRetinopathyGradeOS'],
  'oct': ['opticalCoherenceTomographyOD', 'opticalCoherenceTomographyOS'],
  'imaging': ['fundusPhotographyPerformed', 'fluoresceinAngiographyFindings'],
  'peripheral-vitreous': ['peripheralRetinalExaminationOD', 'peripheralRetinalExaminationOS', 'vitreousExaminationOD', 'vitreousExaminationOS'],
  'amsler-grid': ['amslerGridTestOD', 'amslerGridTestOS', 'retinoschisisseverity'],
};

const ARRAY_FIELDS = ['retinalVascularChangesOD', 'retinalVascularChangesOS'];

const SECTION_ORDER = ['visual-acuity', 'intraocular-pressure', 'pupil-response', 'cup-disc-ratio', 'macular-appearance', 'retinal-vascular-changes', 'diabetic-retinopathy', 'oct', 'imaging', 'peripheral-vitreous', 'amsler-grid'];

/* ======= RENDER FIELD ======= */
const renderField = (record, fn) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;

  if (ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [val];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    );
  }

  return (
    <View key={fn} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(val)}</Text>
    </View>
  );
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const hasAny = fields.some(f => hasVal(record[f]));
  if (!hasAny) return null;

  return (
    <View key={sid} style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
      {fields.map(f => renderField(record, f))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const RetinalExaminationsDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (!docProp) records = [];
  else if (Array.isArray(docProp)) records = docProp;
  else if (docProp?.retinal_examinations) records = Array.isArray(docProp.retinal_examinations) ? docProp.retinal_examinations : [docProp.retinal_examinations];
  else if (docProp?.records) records = Array.isArray(docProp.records) ? docProp.records : [docProp.records];
  else if (docProp?.data) records = Array.isArray(docProp.data) ? docProp.data : [docProp.data];
  else if (docProp?._id) records = [docProp];
  else records = [docProp];

  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Retinal Examinations</Text>
          </View>
          <Text style={styles.noDataText}>No retinal examination records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Retinal Examinations</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.createdAt) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Retinal Examination {idx + 1}</Text>
            </View>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RetinalExaminationsDocumentPDFTemplate;
