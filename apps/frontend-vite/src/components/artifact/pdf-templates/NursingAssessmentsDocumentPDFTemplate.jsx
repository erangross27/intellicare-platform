import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * NursingAssessmentsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * vitalSigns = array of vital-sign objects → each leaf decomposes into a subLabel (leaf label) +
 * a value row (mirrors the JSX label-above-value; never side-by-side).
 * bradenScale / fallRiskScore are hide-zero (a numeric 0 is treated as EMPTY).
 * NO record date is rendered — the record has only createdAt/updatedAt (ingestion timestamps).
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['vital-signs-scores', 'system-assessments', 'functional-nutritional', 'access-therapy', 'infection-education'];

const SECTION_TITLES = {
  'vital-signs-scores': 'Vital Signs & Scores',
  'system-assessments': 'System Assessments',
  'functional-nutritional': 'Functional & Nutritional',
  'access-therapy': 'Access & Therapy',
  'infection-education': 'Infection Control, Education & Discharge',
};

const FIELD_LABELS = {
  vitalSigns: 'Vital Signs',
  painScoreNumeric: 'Pain Score',
  glasgowComaScale: 'Glasgow Coma Scale',
  bradenScale: 'Braden Scale',
  fallRiskScore: 'Fall Risk Score',
  skinIntegrityAssessment: 'Skin Integrity Assessment',
  woundDescription: 'Wound Description',
  mentalStatusExam: 'Mental Status Exam',
  respiratoryAssessment: 'Respiratory Assessment',
  cardiovascularAssessment: 'Cardiovascular Assessment',
  gastrointestinalAssessment: 'Gastrointestinal Assessment',
  genitourinaryAssessment: 'Genitourinary Assessment',
  functionalStatusAssessment: 'Functional Status Assessment',
  nutritionalScreening: 'Nutritional Screening',
  medicationCompliance: 'Medication Compliance',
  intravenousAccess: 'Intravenous Access',
  oxygenTherapy: 'Oxygen Therapy',
  infectionControlMeasures: 'Infection Control Measures',
  patientEducationProvided: 'Patient Education Provided',
  dischargePlanning: 'Discharge Planning',
};

const SECTION_FIELDS = {
  'vital-signs-scores': ['vitalSigns', 'painScoreNumeric', 'glasgowComaScale', 'bradenScale', 'fallRiskScore'],
  'system-assessments': ['skinIntegrityAssessment', 'woundDescription', 'mentalStatusExam', 'respiratoryAssessment', 'cardiovascularAssessment', 'gastrointestinalAssessment', 'genitourinaryAssessment'],
  'functional-nutritional': ['functionalStatusAssessment', 'nutritionalScreening', 'medicationCompliance'],
  'access-therapy': ['intravenousAccess', 'oxygenTherapy'],
  'infection-education': ['infectionControlMeasures', 'patientEducationProvided', 'dischargePlanning'],
};

const NUMBER_FIELDS = ['painScoreNumeric', 'glasgowComaScale', 'bradenScale', 'fallRiskScore'];
const BOOLEAN_FIELDS = ['medicationCompliance'];
const ARRAY_FIELDS = ['infectionControlMeasures'];
const OBJECT_ARRAY_FIELDS = ['vitalSigns'];

const VITAL_SIGN_LABELS = {
  time: 'Time',
  bloodPressure: 'Blood Pressure',
  MAP: 'MAP',
  heartRate: 'Heart Rate',
  respiratoryRate: 'Respiratory Rate',
  temperature: 'Temperature',
  oxygenSaturation: 'Oxygen Saturation',
  painScore: 'Pain Score',
};

/* HELPERS (mirror the JSX) — safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

// hide-zero: a numeric 0 (bradenScale/fallRiskScore "not set") is treated as EMPTY.
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma, decomposing nested "Label: value"
   comma items into their own sub-label (mirrors the JSX decomposition; never side-by-side). */
const sentenceRows = (text) => {
  const rows = [];
  splitBySentence(text).forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) {
        rows.push({ type: 'sub', text: p.label });
        items.forEach(it => {
          const ip = parseLabel(it);
          if (ip.isLabeled) { rows.push({ type: 'sub', text: ip.label }); rows.push({ type: 'item', text: ip.value }); }
          else rows.push({ type: 'item', text: it });
        });
      } else {
        rows.push({ type: 'sub', text: p.label });
        rows.push({ type: 'item', text: p.value });
      }
    } else {
      rows.push({ type: 'item', text: sentence });
    }
  });
  return rows;
};

/* vitalSigns array-of-objects: each object → optional "Set N" subLabel, then each leaf → subLabel + value */
const vitalSignsRows = (val) => {
  const arr = Array.isArray(val) ? val : (val ? [val] : []);
  const rows = [];
  arr.forEach((vs, i) => {
    if (!vs || typeof vs !== 'object') return;
    const entries = Object.entries(vs).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
    if (entries.length === 0) return;
    if (arr.length > 1) rows.push(<Text key={`set-${i}`} style={styles.subLabel}>{safeString(`Set ${i + 1}`)}</Text>);
    entries.forEach(([k, v]) => {
      rows.push(<Text key={`${i}-${k}-l`} style={styles.subLabel}>{safeString(VITAL_SIGN_LABELS[k] || k)}</Text>);
      rows.push(<Text key={`${i}-${k}-v`} style={styles.value}>{safeString(String(v))}</Text>);
    });
  });
  return rows;
};

const arrayListRows = (val) => {
  const arr = Array.isArray(val) ? val : (val ? [val] : []);
  return arr.filter(x => x !== null && x !== undefined && String(x).trim() !== '').map((item, i) => (
    <Text key={i} style={styles.value}>{safeString(String(item))}</Text>
  ));
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.some(o => o && typeof o === 'object' && Object.values(o).some(x => x !== null && x !== undefined && String(x).trim() !== ''));
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return vitalSignsRows(v);
  if (ARRAY_FIELDS.includes(f)) return arrayListRows(v);
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(v ? 'Yes' : 'No')}</Text>];
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return present.map((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    return (
      <View key={f} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {fieldBody(record, f)}
      </View>
    );
  });
};

const NursingAssessmentsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.nursing_assessments) records = Array.isArray(data[0].nursing_assessments) ? data[0].nursing_assessments : [data[0].nursing_assessments];
    else records = data;
  } else if (data?.nursing_assessments) records = Array.isArray(data.nursing_assessments) ? data.nursing_assessments : [data.nursing_assessments];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Nursing Assessments</Text>
          <Text style={styles.noData}>No nursing assessment records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Nursing Assessments</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Nursing Assessment ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default NursingAssessmentsDocumentPDFTemplate;
