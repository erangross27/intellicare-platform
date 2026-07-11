/**
 * DocumentMetadataDocumentPDFTemplate.jsx
 * July 2026 — box-free canonical — LETTER — BLACK & WHITE ONLY (#000000)
 * Collection: document_metadata. Mirrors DocumentMetadataDocument.jsx (4-area rule):
 * numbered value rows, single-name gate, enum canonical display, sentence label:value split,
 * section title rides INSIDE the first field's glue View, per-field wrap={false} anti-orphan, break={idx>0}.
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
  'document-info': 'Document Information', 'patient-info': 'Patient Information', 'diagnoses': 'Diagnoses',
  'codes-section': 'Codes', 'clinical-scores': 'Clinical Scores', 'procedures-section': 'Procedures',
  'lab-allergies': 'Laboratory & Allergies', 'infection-control': 'Infection Control',
};
const FIELD_LABELS = {
  documentType: 'Document Type', specialtyService: 'Specialty Service', urgencyLevel: 'Urgency Level',
  patientMedicalRecordNumber: 'Medical Record Number', encounterNumber: 'Encounter Number',
  primaryDiagnosis: 'Primary Diagnosis', secondaryDiagnoses: 'Secondary Diagnoses',
  icd10Codes: 'ICD-10 Codes', cptCodes: 'CPT Codes', apatiteScore: 'APATITE Score',
  glasgowComaScale: 'Glasgow Coma Scale', nyhaClass: 'NYHA Class', charlsonComorbidityIndex: 'Charlson Comorbidity Index',
  ankleBrachialIndex: 'Ankle Brachial Index', bodyMassIndex: 'Body Mass Index', creatinineClearance: 'Creatinine Clearance',
  ejectionFraction: 'Ejection Fraction', procedurePerformed: 'Procedure Performed', anesthesiaType: 'Anesthesia Type',
  pathologyGrade: 'Pathology Grade', radiologyModality: 'Radiology Modality', laboratoryPanels: 'Laboratory Panels',
  medicationAllergies: 'Medication Allergies', infectiousDisease: 'Infectious Disease', isolationPrecautions: 'Isolation Precautions',
};
const SECTION_FIELDS = {
  'document-info': ['documentType', 'specialtyService', 'urgencyLevel'],
  'patient-info': ['patientMedicalRecordNumber', 'encounterNumber'],
  'diagnoses': ['primaryDiagnosis', 'secondaryDiagnoses'],
  'codes-section': ['icd10Codes', 'cptCodes'],
  'clinical-scores': ['apatiteScore', 'glasgowComaScale', 'nyhaClass', 'charlsonComorbidityIndex', 'ankleBrachialIndex', 'bodyMassIndex', 'creatinineClearance', 'ejectionFraction'],
  'procedures-section': ['procedurePerformed', 'anesthesiaType', 'pathologyGrade', 'radiologyModality'],
  'lab-allergies': ['laboratoryPanels', 'medicationAllergies'],
  'infection-control': ['infectiousDisease', 'isolationPrecautions'],
};
const STRING_ARRAY_FIELDS = ['secondaryDiagnoses', 'icd10Codes', 'cptCodes', 'laboratoryPanels', 'medicationAllergies'];
const NUMBER_FIELDS = ['apatiteScore', 'glasgowComaScale', 'charlsonComorbidityIndex', 'ankleBrachialIndex', 'bodyMassIndex', 'creatinineClearance', 'ejectionFraction'];
const ZERO_NOT_MEANINGFUL = new Set(['apatiteScore', 'glasgowComaScale', 'ankleBrachialIndex', 'bodyMassIndex', 'creatinineClearance', 'ejectionFraction']);
const SENTENCE_FIELDS = ['primaryDiagnosis'];
const ENUM_FIELDS = {
  urgencyLevel: ['Routine', 'Urgent', 'Emergent', 'Elective', 'STAT'],
  nyhaClass: ['Class I', 'Class II', 'Class III', 'Class IV'],
  isolationPrecautions: ['Standard', 'Contact', 'Droplet', 'Airborne', 'Protective'],
  radiologyModality: ['X-ray', 'CT', 'MRI', 'Ultrasound', 'Echocardiogram', 'PET', 'Nuclear Medicine', 'Fluoroscopy', 'Mammography', 'Angiography'],
  anesthesiaType: ['General', 'Regional', 'Local', 'MAC', 'Sedation', 'None'],
};

/* ═══════ UTILS ═══════ */
const enumCanonical = (options, current) => {
  if (current === null || current === undefined || String(current).trim() === '') return '';
  const c = String(current).trim().toLowerCase();
  const match = (options || []).find(o => o.toLowerCase() === c);
  return match || String(current).trim();
};
const isSuppressedZero = (fn, v) => typeof v === 'number' && v === 0 && ZERO_NOT_MEANINGFUL.has(fn);
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  return true;
};
const safeString = (v) => (v === null || v === undefined) ? '' : (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) { const t = cur.trim(); if (t) out.push(t); cur = ''; }
    else { cur += ch; }
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length > 0 ? out : [text];
};
const fieldPresent = (record, fn) => {
  const v = record[fn];
  if (STRING_ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => String(x).trim() !== '').length > 0;
  return hasVal(v) && !isSuppressedZero(fn, v);
};
const dispVal = (fn, v) => ENUM_FIELDS[fn] ? (enumCanonical(ENUM_FIELDS[fn], v) || safeString(v)) : safeString(v);

/* rows for a field → array of {sub?} | {value} (mirror the JSX + copy numbering) */
const fieldRows = (record, fn) => {
  const val = record[fn];
  const rows = [];
  if (STRING_ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    items.forEach((item, i) => rows.push({ value: `${i + 1}. ${safeString(item)}` }));
  } else if (SENTENCE_FIELDS.includes(fn)) {
    let n = 1;
    splitBySentence(safeString(val)).forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        rows.push({ sub: parsed.label });
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) parts.forEach(p => rows.push({ value: `${n++}. ${p}` }));
        else rows.push({ value: `${n++}. ${parsed.value}` });
      } else { rows.push({ value: `${n++}. ${s}` }); }
    });
  } else {
    rows.push({ value: `1. ${dispVal(fn, val)}` });
  }
  return rows;
};

/* one field = one glue View (anti-orphan). sectionTitle rides on the first present field. */
const renderField = (record, fn, sectionTitle) => {
  const label = FIELD_LABELS[fn] || fn;
  const rows = fieldRows(record, fn);
  return (
    <View key={fn} style={styles.fieldGroup} wrap={false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((r, i) => r.sub
        ? <Text key={i} style={styles.fieldLabel}>{r.sub}</Text>
        : <Text key={i} style={styles.fieldValue}>{r.value}</Text>)}
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
const DocumentMetadataDocumentPDFTemplate = ({ document: records }) => {
  const validRecords = (Array.isArray(records) ? records : [records]).filter(r => r && typeof r === 'object');
  const DOC_TITLE = 'Document Metadata';

  if (validRecords.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
          <Text style={styles.noDataText}>No document metadata available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`${DOC_TITLE} ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DocumentMetadataDocumentPDFTemplate;
