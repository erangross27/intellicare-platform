import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * NutritionSupportConsultationDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers, booleans, dates, arrays, sentence-split
 * strings) for JSX/PDF field parity. Hide-zero mirrors the JSX (sentinel-0 numerics are hidden).
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
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['consultation-info', 'anthropometric-assessment', 'nutrition-screening', 'laboratory-markers', 'caloric-requirements', 'enteral-nutrition', 'parenteral-nutrition'];

const SECTION_TITLES = {
  'consultation-info': 'Consultation Information',
  'anthropometric-assessment': 'Anthropometric Assessment',
  'nutrition-screening': 'Nutrition Screening',
  'laboratory-markers': 'Laboratory Markers',
  'caloric-requirements': 'Caloric Requirements',
  'enteral-nutrition': 'Enteral Nutrition',
  'parenteral-nutrition': 'Parenteral Nutrition',
};

const FIELD_LABELS = {
  consultationDate: 'Consultation Date',
  consultationReason: 'Consultation Reason',
  currentBodyMassIndex: 'Current Body Mass Index',
  percentWeightLoss: 'Percent Weight Loss',
  weightLossTimeframeDays: 'Weight Loss Timeframe (Days)',
  nutritionRiskScreeningScore: 'Nutrition Risk Screening Score',
  subjectiveGlobalAssessmentRating: 'Subjective Global Assessment Rating',
  glimMalnutritionDiagnosis: 'GLIM Malnutrition Diagnosis',
  prealbumin: 'Prealbumin',
  serumAlbumin: 'Serum Albumin',
  transferrinLevel: 'Transferrin Level',
  cReactiveProtein: 'C-Reactive Protein',
  estimatedCaloricRequirement: 'Estimated Caloric Requirement',
  proteinRequirementGramsPerKg: 'Protein Requirement (g/kg)',
  indirectCalorimetryPerformed: 'Indirect Calorimetry Performed',
  measuredRestingEnergyExpenditure: 'Measured Resting Energy Expenditure',
  respiratoryQuotient: 'Respiratory Quotient',
  enteralNutritionRoute: 'Enteral Nutrition Route',
  enteralFormulaType: 'Enteral Formula Type',
  enteralFeedingRateMlPerHour: 'Enteral Feeding Rate (mL/hr)',
  parenteralNutritionRequired: 'Parenteral Nutrition Required',
  parenteralAccessType: 'Parenteral Access Type',
  lipidEmulsionType: 'Lipid Emulsion Type',
  refeedingSyndromeRisk: 'Refeeding Syndrome Risk',
  gastricResidualVolumeThreshold: 'Gastric Residual Volume Threshold',
  micronutrientDeficiencies: 'Micronutrient Deficiencies',
};

const SECTION_FIELDS = {
  'consultation-info': ['consultationDate', 'consultationReason'],
  'anthropometric-assessment': ['currentBodyMassIndex', 'percentWeightLoss', 'weightLossTimeframeDays'],
  'nutrition-screening': ['nutritionRiskScreeningScore', 'subjectiveGlobalAssessmentRating', 'glimMalnutritionDiagnosis'],
  'laboratory-markers': ['prealbumin', 'serumAlbumin', 'transferrinLevel', 'cReactiveProtein'],
  'caloric-requirements': ['estimatedCaloricRequirement', 'proteinRequirementGramsPerKg', 'indirectCalorimetryPerformed', 'measuredRestingEnergyExpenditure', 'respiratoryQuotient'],
  'enteral-nutrition': ['enteralNutritionRoute', 'enteralFormulaType', 'enteralFeedingRateMlPerHour'],
  'parenteral-nutrition': ['parenteralNutritionRequired', 'parenteralAccessType', 'lipidEmulsionType', 'refeedingSyndromeRisk', 'gastricResidualVolumeThreshold', 'micronutrientDeficiencies'],
};

const NUMBER_FIELDS = ['currentBodyMassIndex', 'percentWeightLoss', 'weightLossTimeframeDays', 'nutritionRiskScreeningScore', 'prealbumin', 'serumAlbumin', 'transferrinLevel', 'cReactiveProtein', 'estimatedCaloricRequirement', 'proteinRequirementGramsPerKg', 'measuredRestingEnergyExpenditure', 'respiratoryQuotient', 'enteralFeedingRateMlPerHour', 'gastricResidualVolumeThreshold'];
const DATE_FIELDS = ['consultationDate'];
const BOOLEAN_FIELDS = ['glimMalnutritionDiagnosis', 'indirectCalorimetryPerformed', 'parenteralNutritionRequired'];
const ARRAY_FIELDS = ['micronutrientDeficiencies'];

/* MEANINGFUL_ZERO_FIELDS: numerics where 0 is a valid clinical finding and must be shown.
 * All other numeric fields treat 0 as a "not set" sentinel and hide it (mirrors the JSX). */
const MEANINGFUL_ZERO_FIELDS = new Set(['percentWeightLoss', 'nutritionRiskScreeningScore', 'enteralFeedingRateMlPerHour']);

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

/* fieldHasVal: for NUMBER_FIELDS not in MEANINGFUL_ZERO_FIELDS, a value of 0 is a "not set" sentinel and hidden. */
const fieldHasVal = (fn, v) => {
  if (NUMBER_FIELDS.includes(fn) && !MEANINGFUL_ZERO_FIELDS.has(fn)) {
    if (v === null || v === undefined || v === '') return false;
    const n = parseFloat(v); if (isNaN(n)) return false; return n !== 0;
  }
  return hasVal(v);
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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

/* objectRows: flatten a plain object into label/value rows (generic nested-object support) */
const objectRows = (obj) => {
  const rows = [];
  Object.entries(obj).forEach(([k, v]) => {
    if (!hasVal(v)) return;
    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
    rows.push({ type: 'sub', text: label });
    if (Array.isArray(v)) v.filter(hasVal).forEach(it => rows.push({ type: 'item', text: typeof it === 'object' ? JSON.stringify(it) : String(it) }));
    else if (typeof v === 'object') rows.push({ type: 'item', text: safeString(fmtVal(v)) });
    else rows.push({ type: 'item', text: safeString(fmtVal(v)) });
  });
  return rows;
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (ARRAY_FIELDS.includes(f) || Array.isArray(v)) {
    const items = (Array.isArray(v) ? v : [v]).filter(hasVal);
    if (items.length === 0) return [<Text key="v" style={styles.value}>{safeString(fmtVal(v))}</Text>];
    return items.map((item, i) => (typeof item === 'object'
      ? objectRows(item).map((r, j) => r.type === 'sub'
          ? <Text key={`${i}-${j}`} style={styles.subLabel}>{safeString(r.text)}</Text>
          : <Text key={`${i}-${j}`} style={styles.value}>{strip(r.text)}</Text>)
      : <Text key={i} style={styles.value}>{safeString(String(item))}</Text>));
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldHasVal(f, record[f]));
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

const NutritionSupportConsultationDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') {
    if (data.nutrition_support_consultation) records = Array.isArray(data.nutrition_support_consultation) ? data.nutrition_support_consultation : [data.nutrition_support_consultation];
    else if (data.documentData) records = Array.isArray(data.documentData) ? data.documentData : [data.documentData];
    else records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Nutrition Support Consultation</Text>
          <Text style={styles.noData}>No nutrition support consultation data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Nutrition Support Consultation</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Nutrition Support Consultation ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default NutritionSupportConsultationDocumentPDFTemplate;
