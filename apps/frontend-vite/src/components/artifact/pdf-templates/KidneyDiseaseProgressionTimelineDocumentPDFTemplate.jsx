import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * KidneyDiseaseProgressionTimelineDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity:
 *   - Numbers → numeric presence (sentinel-0 hidden EXCEPT proteinuria markers ACR/PCR).
 *   - Strings → multi-sentence narratives decomposed via splitBySentence + parseLabel.
 *   - Arrays  → comorbidConditions as a numbered list.
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
const SECTION_ORDER = ['kidney-function', 'mineral-bone', 'size-imaging', 'dialysis'];

const SECTION_TITLES = {
  'kidney-function': 'Kidney Function',
  'mineral-bone': 'Mineral & Bone',
  'size-imaging': 'Size & Imaging',
  'dialysis': 'Dialysis & Transplant',
};

const FIELD_LABELS = {
  estimatedGlomerularFiltrationRate: 'Estimated GFR (mL/min/1.73m²)',
  serumCreatinine: 'Serum Creatinine (mg/dL)',
  bloodUreaNitrogen: 'Blood Urea Nitrogen (mg/dL)',
  chronicKidneyDiseaseStage: 'CKD Stage',
  albuminCreatinineRatio: 'Albumin-Creatinine Ratio (mg/g)',
  proteinCreatinineRatio: 'Protein-Creatinine Ratio (mg/g)',
  albuminuriaCategory: 'Albuminuria Category',
  acidBaseStatus: 'Acid-Base Status',
  hemoglobinLevel: 'Hemoglobin (g/dL)',
  serumPhosphorus: 'Serum Phosphorus (mg/dL)',
  serumCalcium: 'Serum Calcium (mg/dL)',
  parathyroidHormone: 'Parathyroid Hormone (pg/mL)',
  vitamin25OHD: 'Vitamin D 25-OH (ng/mL)',
  renalUltrasoundFindings: 'Renal Ultrasound Findings',
  kidneySizeLeftCm: 'Kidney Size Left (cm)',
  kidneySizeRightCm: 'Kidney Size Right (cm)',
  systemicBloodPressure: 'Systemic Blood Pressure',
  renalBiopsyResults: 'Renal Biopsy Results',
  dialysisModalityType: 'Dialysis Modality Type',
  dialysisAdequacyKtV: 'Dialysis Adequacy Kt/V',
  vascularAccessType: 'Vascular Access Type',
  transplantEvaluationStatus: 'Transplant Evaluation Status',
  comorbidConditions: 'Comorbid Conditions',
};

const SECTION_FIELDS = {
  'kidney-function': ['estimatedGlomerularFiltrationRate', 'serumCreatinine', 'bloodUreaNitrogen', 'chronicKidneyDiseaseStage', 'albuminCreatinineRatio', 'proteinCreatinineRatio', 'albuminuriaCategory', 'acidBaseStatus'],
  'mineral-bone': ['hemoglobinLevel', 'serumPhosphorus', 'serumCalcium', 'parathyroidHormone', 'vitamin25OHD'],
  'size-imaging': ['renalUltrasoundFindings', 'kidneySizeLeftCm', 'kidneySizeRightCm', 'systemicBloodPressure', 'renalBiopsyResults'],
  'dialysis': ['dialysisModalityType', 'dialysisAdequacyKtV', 'vascularAccessType', 'transplantEvaluationStatus', 'comorbidConditions'],
};

const NUMBER_FIELDS = [
  'estimatedGlomerularFiltrationRate', 'serumCreatinine', 'bloodUreaNitrogen',
  'albuminCreatinineRatio', 'proteinCreatinineRatio',
  'hemoglobinLevel', 'serumPhosphorus', 'serumCalcium',
  'parathyroidHormone', 'vitamin25OHD',
  'kidneySizeLeftCm', 'kidneySizeRightCm',
  'dialysisAdequacyKtV',
];
/* 0 is a reportable value for these (proteinuria absent), not a sentinel. */
const MEANINGFUL_ZERO_FIELDS = ['albuminCreatinineRatio', 'proteinCreatinineRatio'];
const ARRAY_FIELDS = ['comorbidConditions'];

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

const hasNumber = (fn, v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  if (isNaN(n)) return false;
  if (n !== 0) return true;
  return MEANINGFUL_ZERO_FIELDS.includes(fn);
};

const fieldHasVal = (fn, v) => {
  if (NUMBER_FIELDS.includes(fn)) return hasNumber(fn, v);
  if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.length > 0;
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return String(v).trim() !== '';
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
  if (ARRAY_FIELDS.includes(f)) {
    const arr = Array.isArray(v) ? v : [v];
    return arr.map((item, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(item)}`}</Text>);
  }
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
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

const KidneyDiseaseProgressionTimelineDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Kidney Disease Progression Timeline</Text>
          <Text style={styles.noData}>No kidney disease progression timeline records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Kidney Disease Progression Timeline</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Kidney Disease Progression Timeline ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default KidneyDiseaseProgressionTimelineDocumentPDFTemplate;
