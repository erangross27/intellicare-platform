import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MortalityRiskAssessmentDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (hide-zero numbers, booleans as Yes/No, arrays,
 * sentence fields) for JSX/PDF field parity. No boxes: underline rules only
 * (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
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
const SECTION_ORDER = ['assessment-info', 'risk-scores', 'organ-support', 'risk-factors'];

const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'risk-scores': 'Risk Scores',
  'organ-support': 'Organ Support & Status',
  'risk-factors': 'Risk Factors',
};

const FIELD_LABELS = {
  date: 'Date',
  assessmentMethod: 'Assessment Method',
  timeframeOfPrediction: 'Timeframe of Prediction',
  riskCategory: 'Risk Category',
  acuityLevel: 'Acuity Level',
  primaryDiagnosisCode: 'Primary Diagnosis Code',
  ageAtAssessment: 'Age at Assessment',
  assessorCredentials: 'Assessor Credentials',
  admissionType: 'Admission Type',
  reassessmentInterval: 'Reassessment Interval',
  totalRiskScore: 'Total Risk Score',
  predictedMortalityPercentage: 'Predicted Mortality %',
  comorbidityCount: 'Comorbidity Count',
  functionalStatusScore: 'Functional Status Score',
  organFailureCount: 'Organ Failure Count',
  glasgowComaScore: 'Glasgow Coma Score',
  mechanicalVentilationRequired: 'Mechanical Ventilation Required',
  vasopressorSupport: 'Vasopressor Support',
  renalReplacementTherapy: 'Renal Replacement Therapy',
  sepsisPresent: 'Sepsis Present',
  cardiacArrestHistory: 'Cardiac Arrest History',
  malignancyStatus: 'Malignancy Status',
  surgicalProcedureRisk: 'Surgical Procedure Risk',
  palliativeCareConsulted: 'Palliative Care Consulted',
  vitalSignsAbnormalities: 'Vital Signs Abnormalities',
  laboratoryRiskFactors: 'Laboratory Risk Factors',
};

const SECTION_FIELDS = {
  'assessment-info': ['date', 'assessmentMethod', 'timeframeOfPrediction', 'riskCategory', 'acuityLevel', 'primaryDiagnosisCode', 'ageAtAssessment', 'assessorCredentials', 'admissionType', 'reassessmentInterval'],
  'risk-scores': ['totalRiskScore', 'predictedMortalityPercentage', 'comorbidityCount', 'functionalStatusScore', 'organFailureCount', 'glasgowComaScore'],
  'organ-support': ['mechanicalVentilationRequired', 'vasopressorSupport', 'renalReplacementTherapy', 'sepsisPresent', 'cardiacArrestHistory', 'malignancyStatus', 'surgicalProcedureRisk', 'palliativeCareConsulted'],
  'risk-factors': ['vitalSignsAbnormalities', 'laboratoryRiskFactors'],
};

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['totalRiskScore', 'predictedMortalityPercentage', 'ageAtAssessment', 'comorbidityCount', 'functionalStatusScore', 'organFailureCount', 'glasgowComaScore'];
const BOOLEAN_FIELDS = ['mechanicalVentilationRequired', 'vasopressorSupport', 'renalReplacementTherapy', 'sepsisPresent', 'cardiacArrestHistory', 'palliativeCareConsulted'];
const ARRAY_FIELDS = ['vitalSignsAbnormalities', 'laboratoryRiskFactors'];

/* HELPERS (mirror the JSX) */
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

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* hide-zero: a numeric 0 is treated as "not recorded" (empty) and hidden unless the doctor edited it */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
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

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : [v]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(String(it))}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

/* field presence respecting hide-zero + boolean */
const fieldPresent = (record, f) => {
  if (NUMBER_FIELDS.includes(f)) return numberShowsPDF(record, f);
  if (BOOLEAN_FIELDS.includes(f)) return typeof record[f] === 'boolean';
  return hasVal(record[f]);
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

const MortalityRiskAssessmentDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.flatMap(r => {
    if (r?.mortality_risk_assessment) return Array.isArray(r.mortality_risk_assessment) ? r.mortality_risk_assessment : [r.mortality_risk_assessment];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.mortality_risk_assessment) return Array.isArray(dd.mortality_risk_assessment) ? dd.mortality_risk_assessment : [dd.mortality_risk_assessment]; return [dd]; }
    return [r];
  }).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Mortality Risk Assessment</Text>
          <Text style={styles.noData}>No mortality risk assessment records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Mortality Risk Assessment</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Mortality Risk Assessment ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MortalityRiskAssessmentDocumentPDFTemplate;
