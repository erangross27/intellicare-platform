import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MentalHealthResourcesDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (scores hide at 0, empty strings/arrays skipped)
 * for JSX/PDF field parity. No boxes: underline rules only
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
const SECTION_ORDER = ['psychiatric-scales', 'diagnostic-formulation', 'medications', 'clinical-assessment', 'risk-safety', 'support-recovery'];

const SECTION_TITLES = {
  'psychiatric-scales': 'Psychiatric Rating Scales',
  'diagnostic-formulation': 'Diagnostic Formulation',
  'medications': 'Current Psychotropic Medications',
  'clinical-assessment': 'Clinical Assessment',
  'risk-safety': 'Risk & Safety',
  'support-recovery': 'Support & Recovery',
};

const FIELD_LABELS = {
  gafScore: 'GAF Score',
  phr9Score: 'PHQ-9 Score',
  gad7Score: 'GAD-7 Score',
  mdrsScore: 'MADRS Score',
  hamiltonAnxietyScore: 'Hamilton Anxiety (HAM-A)',
  panssPositiveScore: 'PANSS Positive',
  panssNegativeScore: 'PANSS Negative',
  ymrsScore: 'YMRS Score',
  miniMentalStateScore: 'MMSE Score',
  columbiaRiskScore: 'Columbia Suicide Risk (C-SSRS)',
  traumaScreeningScore: 'Trauma Screening (PCL-5)',
  dsmFiveAxisDiagnosis: 'DSM-5 Diagnosis',
  icd11MentalHealthCodes: 'ICD-11 Codes',
  currentPsychotropicMedications: 'Current Psychotropic Medications',
  mentalStatusExamination: 'Mental Status Examination',
  functionalImpairmentLevel: 'Functional Impairment Level',
  substanceUseScreeningResult: 'Substance Use Screening',
  treatmentComplianceStatus: 'Treatment Compliance',
  psychotherapyModalityType: 'Psychotherapy Modality',
  crisisInterventionPlan: 'Crisis Intervention Plan',
  riskFactorIdentification: 'Risk Factors',
  socialSupportNetworkAssessment: 'Social Support Network',
  recoveryGoalsAndTargets: 'Recovery Goals & Targets',
};

const SECTION_FIELDS = {
  'psychiatric-scales': ['gafScore', 'phr9Score', 'gad7Score', 'mdrsScore', 'hamiltonAnxietyScore', 'panssPositiveScore', 'panssNegativeScore', 'ymrsScore', 'miniMentalStateScore', 'columbiaRiskScore', 'traumaScreeningScore'],
  'diagnostic-formulation': ['dsmFiveAxisDiagnosis', 'icd11MentalHealthCodes'],
  'medications': ['currentPsychotropicMedications'],
  'clinical-assessment': ['mentalStatusExamination', 'functionalImpairmentLevel', 'substanceUseScreeningResult', 'treatmentComplianceStatus', 'psychotherapyModalityType'],
  'risk-safety': ['crisisInterventionPlan', 'riskFactorIdentification'],
  'support-recovery': ['socialSupportNetworkAssessment', 'recoveryGoalsAndTargets'],
};

const SCORE_FIELDS = [
  'gafScore', 'phr9Score', 'gad7Score', 'mdrsScore', 'hamiltonAnxietyScore',
  'panssPositiveScore', 'panssNegativeScore', 'ymrsScore', 'miniMentalStateScore',
  'columbiaRiskScore', 'traumaScreeningScore',
];
const SCORE_MAX = {
  gafScore: 100, phr9Score: 27, gad7Score: 21, mdrsScore: 60, hamiltonAnxietyScore: 56,
  panssPositiveScore: 49, panssNegativeScore: 49, ymrsScore: 60, miniMentalStateScore: 30,
  columbiaRiskScore: null, traumaScreeningScore: null,
};
const ARRAY_FIELDS = ['dsmFiveAxisDiagnosis', 'icd11MentalHealthCodes', 'currentPsychotropicMedications', 'riskFactorIdentification', 'recoveryGoalsAndTargets'];

/* HELPERS (mirror the JSX) */
const safeString = (val) => {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, "");
};

/* numeric presence (0 = not assessed => hidden) */
const hasScore = (v) => {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) && n !== 0;
};
const safeArray = (val) => Array.isArray(val) ? val.filter(item => item !== null && item !== undefined && String(item).trim() !== '') : [];
const hasText = (v) => typeof v === 'string' ? v.trim() !== '' : (v !== null && v !== undefined && v !== '');

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

const scoreDisplay = (f, v) => { const max = SCORE_MAX[f]; return max ? `${v} / ${max}` : String(v); };

const hasField = (record, f) => {
  if (SCORE_FIELDS.includes(f)) return hasScore(record[f]);
  if (ARRAY_FIELDS.includes(f)) return safeArray(record[f]).length > 0;
  return hasText(record[f]);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (SCORE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(scoreDisplay(f, v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const arr = safeArray(v);
    const out = [];
    arr.forEach((item, i) => {
      const p = parseLabel(String(item));
      if (p.isLabeled) {
        out.push(<Text key={`s${i}`} style={styles.subLabel}>{safeString(p.label)}</Text>);
        out.push(<Text key={`i${i}`} style={styles.value}>{`${i + 1}. `}{strip(p.value)}</Text>);
      } else {
        out.push(<Text key={i} style={styles.value}>{`${i + 1}. `}{safeString(String(item))}</Text>);
      }
    });
    return out;
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasField(record, f));
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

const MentalHealthResourcesDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = data;
  if (records && records.mental_health_resources) records = records.mental_health_resources;
  if (Array.isArray(records) && records.length === 1 && records[0]?.mental_health_resources) records = records[0].mental_health_resources;
  if (!Array.isArray(records)) records = records && typeof records === 'object' ? [records] : [];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Mental Health Resources</Text>
          <Text style={styles.noData}>No mental health resources records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Mental Health Resources</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Mental Health Resources ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MentalHealthResourcesDocumentPDFTemplate;
