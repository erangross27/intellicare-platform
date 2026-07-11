/**
 * DocumentTypeDocumentPDFTemplate.jsx
 * July 2026 — box-free canonical — LETTER — BLACK & WHITE ONLY (#000000)
 * Collection: document_type ("Document Type"). Mirrors DocumentTypeDocument.jsx (4-area rule):
 * numbered value rows, boolean Yes/No, enum canonical, hide-zero numerics, date fmtDate (null hidden),
 * arrays verbatim; section title rides INSIDE the first field's glue View, per-field wrap={false}
 * anti-orphan, break={idx>0}.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center' },
  recordContainer: { paddingBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ═══════ CONFIG (mirror JSX) ═══════ */
const SECTION_TITLES = {
  'document-info': 'Document Information', 'diagnosis-codes': 'Diagnosis Codes', 'procedure-codes': 'Procedure Codes',
  'clinical-metrics': 'Clinical Metrics', 'quality-compliance': 'Quality & Compliance',
};
const FIELD_LABELS = {
  documentSubtype: 'Document Subtype', consultingSpecialty: 'Consulting Specialty', patientMedicalRecordNumber: 'Medical Record Number',
  attendingPhysicianNpi: 'Attending Physician NPI', admissionDate: 'Admission Date', dischargeDate: 'Discharge Date',
  lengthOfStay: 'Length of Stay (days)', icd10DiagnosisCodes: 'ICD-10 Diagnosis Codes', cptProcedureCodes: 'CPT Procedure Codes',
  apacheIIScore: 'APACHE II Score', glasgowComaScale: 'Glasgow Coma Scale', nyhaClassification: 'NYHA Classification',
  ejectionFraction: 'Ejection Fraction (%)', estimatedGfr: 'eGFR', bodyMassIndex: 'BMI', ankleBrachialIndex: 'Ankle-Brachial Index',
  hemoglobinA1c: 'HbA1c (%)', brainNatriureticPeptide: 'BNP (pg/mL)', troponinLevel: 'Troponin (ng/mL)',
  internationalNormalizedRatio: 'INR', cReactiveProtein: 'CRP (mg/L)', criticalPathwayCompliance: 'Critical Pathway Compliance',
  qualityMeasureCompliance: 'Quality Measure Compliance', adverseEventReported: 'Adverse Event Reported', medicationReconciliation: 'Medication Reconciliation',
};
const SECTION_FIELDS = {
  'document-info': ['documentSubtype', 'consultingSpecialty', 'patientMedicalRecordNumber', 'attendingPhysicianNpi', 'admissionDate', 'dischargeDate', 'lengthOfStay'],
  'diagnosis-codes': ['icd10DiagnosisCodes'],
  'procedure-codes': ['cptProcedureCodes'],
  'clinical-metrics': ['apacheIIScore', 'glasgowComaScale', 'nyhaClassification', 'ejectionFraction', 'estimatedGfr', 'bodyMassIndex', 'ankleBrachialIndex', 'hemoglobinA1c', 'brainNatriureticPeptide', 'troponinLevel', 'internationalNormalizedRatio', 'cReactiveProtein'],
  'quality-compliance': ['criticalPathwayCompliance', 'qualityMeasureCompliance', 'adverseEventReported', 'medicationReconciliation'],
};
const NUMBER_FIELDS = ['lengthOfStay', 'apacheIIScore', 'glasgowComaScale', 'ejectionFraction', 'estimatedGfr', 'bodyMassIndex', 'ankleBrachialIndex', 'hemoglobinA1c', 'brainNatriureticPeptide', 'troponinLevel', 'internationalNormalizedRatio', 'cReactiveProtein'];
const HIDE_ZERO_FIELDS = new Set(NUMBER_FIELDS);
const BOOLEAN_FIELDS = ['criticalPathwayCompliance', 'qualityMeasureCompliance', 'adverseEventReported', 'medicationReconciliation'];
const ARRAY_FIELDS = ['icd10DiagnosisCodes', 'cptProcedureCodes'];
const DATE_FIELDS = ['admissionDate', 'dischargeDate'];
const ENUM_FIELDS = { nyhaClassification: ['Class I', 'Class II', 'Class III', 'Class IV'] };

/* ═══════ UTILS ═══════ */
const enumCanonical = (options, current) => {
  if (current === null || current === undefined || String(current).trim() === '') return '';
  const c = String(current).trim().toLowerCase();
  const match = (options || []).find(o => o.toLowerCase() === c);
  return match || String(current).trim();
};
const parseDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  let d;
  if (v instanceof Date) d = v; else if (typeof v === 'object' && v.$date) d = new Date(v.$date); else d = new Date(v);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() <= 0 || d.getUTCFullYear() <= 1970) return null;
  return d;
};
const fmtDate = (v) => { const d = parseDate(v); return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : ''; };
const arrItem = (x) => (x === null || x === undefined) ? '' : (typeof x === 'object' ? (x.code || x.value || x.text || JSON.stringify(x)) : String(x));

const fieldPresent = (record, fn) => {
  const v = record[fn];
  if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => arrItem(x).trim() !== '').length > 0;
  if (BOOLEAN_FIELDS.includes(fn)) return typeof v === 'boolean';
  if (NUMBER_FIELDS.includes(fn)) { if (v === null || v === undefined || v === '') return false; const n = Number(v); if (!Number.isFinite(n)) return false; if (n === 0 && HIDE_ZERO_FIELDS.has(fn)) return false; return true; }
  if (DATE_FIELDS.includes(fn)) return parseDate(v) !== null;
  return v !== null && v !== undefined && String(v).trim() !== '';
};
const dispVal = (fn, v) => {
  if (BOOLEAN_FIELDS.includes(fn)) return v ? 'Yes' : 'No';
  if (ENUM_FIELDS[fn]) return enumCanonical(ENUM_FIELDS[fn], v) || String(v);
  if (DATE_FIELDS.includes(fn)) return fmtDate(v);
  return String(v);
};
const fieldRows = (record, fn) => {
  const v = record[fn];
  if (ARRAY_FIELDS.includes(fn)) {
    return v.filter(x => arrItem(x).trim() !== '').map((x, i) => ({ value: `${i + 1}. ${arrItem(x)}` }));
  }
  return [{ value: `1. ${dispVal(fn, v)}` }];
};

const renderField = (record, fn, sectionTitle) => {
  const label = FIELD_LABELS[fn] || fn;
  const rows = fieldRows(record, fn);
  return (
    <View key={fn} style={styles.fieldGroup} wrap={false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((r, i) => <Text key={i} style={styles.fieldValue}>{r.value}</Text>)}
    </View>
  );
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return present.map((f, i) => renderField(record, f, i === 0 ? title : null));
};

/* ═══════ MAIN ═══════ */
const DocumentTypeDocumentPDFTemplate = ({ document: records }) => {
  const valid = (Array.isArray(records) ? records : [records]).filter(r => r && typeof r === 'object');
  const DOC_TITLE = 'Document Type';
  if (valid.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
          <Text style={styles.noDataText}>No document type data available.</Text>
        </Page>
      </Document>
    );
  }
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
        {valid.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`${DOC_TITLE} ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DocumentTypeDocumentPDFTemplate;
