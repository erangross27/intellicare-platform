import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * JobHazardAnalysisDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0) for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
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
  listItem: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = [
  'job-information', 'task-sequence-steps', 'identified-hazards', 'injuries-exposure',
  'risk-assessment', 'physical-exposures', 'chemical-exposures', 'control-measures',
  'ergonomic-risk-factors', 'surveillance-emergency', 'training-requirements', 'review-status',
];

const SECTION_TITLES = {
  'job-information': 'Job Information',
  'task-sequence-steps': 'Task Sequence Steps',
  'identified-hazards': 'Identified Hazards',
  'injuries-exposure': 'Potential Injuries & Exposure Routes',
  'risk-assessment': 'Risk Assessment',
  'physical-exposures': 'Physical Exposures',
  'chemical-exposures': 'Chemical Exposures',
  'control-measures': 'Control Measures',
  'ergonomic-risk-factors': 'Ergonomic Risk Factors',
  'surveillance-emergency': 'Medical Surveillance & Emergency Procedures',
  'training-requirements': 'Training Requirements',
  'review-status': 'Review Status',
};

const FIELD_LABELS = {
  date: 'Date',
  jobTitle: 'Job Title',
  workLocation: 'Work Location',
  supervisorName: 'Supervisor Name',
  taskSequenceSteps: 'Task Sequence Steps',
  identifiedHazards: 'Identified Hazards',
  hazardCategory: 'Hazard Category',
  potentialInjuries: 'Potential Injuries',
  exposureRoutes: 'Exposure Routes',
  riskSeverityLevel: 'Risk Severity Level',
  probabilityOfOccurrence: 'Probability of Occurrence',
  noiseExposureLevel: 'Noise Exposure Level (dB)',
  vibrationExposure: 'Vibration Exposure',
  thermalStressFactors: 'Thermal Stress Factors',
  chemicalExposureSubstances: 'Chemical Exposure Substances',
  permissibleExposureLimits: 'Permissible Exposure Limits',
  existingControlMeasures: 'Existing Control Measures',
  engineeringControls: 'Engineering Controls',
  administrativeControls: 'Administrative Controls',
  requiredPersonalProtectiveEquipment: 'Required Personal Protective Equipment',
  ergonomicRiskFactors: 'Ergonomic Risk Factors',
  requiredMedicalSurveillance: 'Required Medical Surveillance',
  emergencyResponseProcedures: 'Emergency Response Procedures',
  trainingRequirements: 'Training Requirements',
  reviewedByOccupationalHealth: 'Reviewed by Occupational Health',
  analysisReviewDate: 'Analysis Review Date',
};

const SECTION_FIELDS = {
  'job-information': ['date', 'jobTitle', 'workLocation', 'supervisorName'],
  'task-sequence-steps': ['taskSequenceSteps'],
  'identified-hazards': ['identifiedHazards', 'hazardCategory'],
  'injuries-exposure': ['potentialInjuries', 'exposureRoutes'],
  'risk-assessment': ['riskSeverityLevel', 'probabilityOfOccurrence'],
  'physical-exposures': ['noiseExposureLevel', 'vibrationExposure', 'thermalStressFactors'],
  'chemical-exposures': ['chemicalExposureSubstances', 'permissibleExposureLimits'],
  'control-measures': ['existingControlMeasures', 'engineeringControls', 'administrativeControls', 'requiredPersonalProtectiveEquipment'],
  'ergonomic-risk-factors': ['ergonomicRiskFactors'],
  'surveillance-emergency': ['requiredMedicalSurveillance', 'emergencyResponseProcedures'],
  'training-requirements': ['trainingRequirements'],
  'review-status': ['reviewedByOccupationalHealth', 'analysisReviewDate'],
};

const ARRAY_FIELDS = ['taskSequenceSteps', 'identifiedHazards', 'hazardCategory', 'potentialInjuries', 'exposureRoutes', 'existingControlMeasures', 'requiredPersonalProtectiveEquipment', 'engineeringControls', 'administrativeControls', 'ergonomicRiskFactors', 'chemicalExposureSubstances', 'permissibleExposureLimits', 'requiredMedicalSurveillance', 'emergencyResponseProcedures', 'trainingRequirements'];
const SENTENCE_FIELDS = ['vibrationExposure', 'thermalStressFactors'];
const BOOLEAN_FIELDS = ['reviewedByOccupationalHealth'];
const DATE_FIELDS = ['date', 'analysisReviewDate'];
const NUMBER_FIELDS = ['noiseExposureLevel'];

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
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const arrItemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' - ');
  return String(item);
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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
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
   comma items into their own sub-label (mirrors the JSX decomposition; never side-by-side).
   A single unlabeled value with comma items is split into rows (aggressive-split parity with the JSX). */
const sentenceRows = (text) => {
  const rows = [];
  const sentences = splitBySentence(text);
  if (sentences.length <= 1) {
    const commaItems = splitByComma(String(text));
    const hasOxford = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
    if (commaItems.length >= 2 && !hasOxford) {
      commaItems.forEach(ci => rows.push({ type: 'item', text: ci }));
      return rows;
    }
    if (sentences.length === 1) rows.push({ type: 'item', text: sentences[0] });
    return rows;
  }
  sentences.forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      const hasOxford = items.some(ci => ci.trim().toLowerCase().startsWith('and '));
      if (items.length >= 2 && !hasOxford) {
        rows.push({ type: 'sub', text: p.label });
        items.forEach(it => rows.push({ type: 'item', text: it }));
      } else {
        rows.push({ type: 'item', text: sentence });
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
    const items = (Array.isArray(v) ? v : []).map(arrItemText).filter(Boolean);
    return items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {strip(it)}</Text>);
  }
  if (SENTENCE_FIELDS.includes(f)) {
    const rows = sentenceRows(String(v));
    if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
    if (rows.length === 1 && rows[0].type === 'item') return [<Text key="v" style={styles.value}>{strip(rows[0].text)}</Text>];
    let n = 1;
    return rows.map((r, i) => r.type === 'sub'
      ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
      : <Text key={i} style={styles.listItem}>{n++}. {strip(r.text)}</Text>);
  }
  return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
};

const fieldHasVal = (record, f) => {
  const v = record[f];
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.some(item => arrItemText(item));
  return hasVal(v);
};

const renderSection = (record, sid) => {
  const fields = (SECTION_FIELDS[sid] || []).filter(f => fieldHasVal(record, f));
  if (fields.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return (
    <View key={sid}>
      {fields.map((f, i) => {
        const label = FIELD_LABELS[f] || f;
        const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
        return (
          <View key={f} style={styles.fieldWrap} wrap={false}>
            {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
            {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
            {fieldBody(record, f)}
          </View>
        );
      })}
    </View>
  );
};

/* ======= COMPONENT ======= */
const JobHazardAnalysisDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.flatMap(r => {
    if (r?.job_hazard_analysis) return Array.isArray(r.job_hazard_analysis) ? r.job_hazard_analysis : [r.job_hazard_analysis];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.job_hazard_analysis) return Array.isArray(dd.job_hazard_analysis) ? dd.job_hazard_analysis : [dd.job_hazard_analysis]; return [dd]; }
    return [r];
  }).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Job Hazard Analysis</Text>
          <Text style={styles.noData}>No job hazard analysis records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Job Hazard Analysis</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Job Hazard Analysis ${(record._originalIdx ?? rIdx) + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default JobHazardAnalysisDocumentPDFTemplate;
