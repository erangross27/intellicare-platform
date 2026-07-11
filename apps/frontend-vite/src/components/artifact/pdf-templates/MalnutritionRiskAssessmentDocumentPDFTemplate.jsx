import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MalnutritionRiskAssessmentDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (booleans, arrays, numbers with hide-zero) for
 * JSX/PDF field parity. No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 /
 * fieldLabel 0.5). Record date = record.date (rendered as a header meta line)  - NEVER createdAt/updatedAt.
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordMeta: { fontSize: 11, color: '#000000', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['screening-info', 'anthropometric-data', 'dietary-intake', 'disease-impact', 'lab-markers', 'intervention-plan', 'psychosocial-barriers'];

const SECTION_TITLES = {
  'screening-info': 'Screening Information',
  'anthropometric-data': 'Anthropometric Data',
  'dietary-intake': 'Dietary Intake',
  'disease-impact': 'Disease Impact',
  'lab-markers': 'Laboratory Markers',
  'intervention-plan': 'Intervention Plan',
  'psychosocial-barriers': 'Psychosocial Barriers',
};

const FIELD_LABELS = {
  screeningToolUsed: 'Screening Tool Used',
  totalRiskScore: 'Total Risk Score',
  riskCategory: 'Risk Category',
  bodyMassIndex: 'Body Mass Index',
  unintentionalWeightLoss: 'Unintentional Weight Loss',
  weightLossPercentage: 'Weight Loss Percentage',
  weightLossTimeframe: 'Weight Loss Timeframe',
  midUpperArmCircumference: 'Mid-Upper Arm Circumference',
  reducedDietaryIntake: 'Reduced Dietary Intake',
  appetiteLevel: 'Appetite Level',
  dysphagia: 'Dysphagia',
  gastrointestinalSymptoms: 'Gastrointestinal Symptoms',
  acuteDiseaseEffect: 'Acute Disease Effect',
  chronicDiseaseImpact: 'Chronic Disease Impact',
  functionalCapacity: 'Functional Capacity',
  sarcopenia: 'Sarcopenia',
  edemaPresent: 'Edema Present',
  albuminLevel: 'Albumin Level',
  prealbumin: 'Prealbumin',
  nutritionInterventionRequired: 'Nutrition Intervention Required',
  recommendedInterventions: 'Recommended Interventions',
  dietitianReferralMade: 'Dietitian Referral Made',
  reassessmentInterval: 'Reassessment Interval',
  psychosocialBarriers: 'Psychosocial Barriers',
  oralHealthIssues: 'Oral Health Issues',
};

const SECTION_FIELDS = {
  'screening-info': ['screeningToolUsed', 'totalRiskScore', 'riskCategory'],
  'anthropometric-data': ['bodyMassIndex', 'unintentionalWeightLoss', 'weightLossPercentage', 'weightLossTimeframe', 'midUpperArmCircumference'],
  'dietary-intake': ['reducedDietaryIntake', 'appetiteLevel', 'dysphagia', 'gastrointestinalSymptoms'],
  'disease-impact': ['acuteDiseaseEffect', 'chronicDiseaseImpact', 'functionalCapacity', 'sarcopenia', 'edemaPresent'],
  'lab-markers': ['albuminLevel', 'prealbumin'],
  'intervention-plan': ['nutritionInterventionRequired', 'recommendedInterventions', 'dietitianReferralMade', 'reassessmentInterval'],
  'psychosocial-barriers': ['psychosocialBarriers', 'oralHealthIssues'],
};

const NUMBER_FIELDS = ['totalRiskScore', 'bodyMassIndex', 'weightLossPercentage', 'albuminLevel', 'prealbumin', 'midUpperArmCircumference'];
const BOOLEAN_FIELDS = ['unintentionalWeightLoss', 'reducedDietaryIntake', 'dysphagia', 'acuteDiseaseEffect', 'nutritionInterventionRequired', 'dietitianReferralMade', 'sarcopenia', 'edemaPresent', 'oralHealthIssues'];
const ARRAY_FIELDS = ['gastrointestinalSymptoms', 'recommendedInterventions', 'psychosocialBarriers'];
const DATE_FIELDS = [];
/* MEANINGFUL_ZERO_FIELDS: only weight-loss 0% (= stable weight) is a valid finding at 0; every other number
   (totalRiskScore, bodyMassIndex, albuminLevel, prealbumin, midUpperArmCircumference) treats 0 as a "not
   measured / not scored" sentinel and hides it. */
const MEANINGFUL_ZERO_FIELDS = ['weightLossPercentage'];

/* HELPERS (mirror the JSX)  - safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars) */
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

const numberShows = (fn, val) => {
  if (val === null || val === undefined || val === '') return false;
  const n = typeof val === 'number' ? val : Number(val);
  if (Number.isNaN(n)) return false;
  if (n === 0) return MEANINGFUL_ZERO_FIELDS.includes(fn);
  return true;
};

const fieldShows = (record, f) => {
  const v = record[f];
  if (NUMBER_FIELDS.includes(f)) return numberShows(f, v);
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(Boolean).length > 0;
  return hasVal(v);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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
    const items = (Array.isArray(v) ? v : []).filter(Boolean);
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(String(it))}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldShows(record, f));
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

const MalnutritionRiskAssessmentDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.malnutrition_risk_assessment) records = Array.isArray(data[0].malnutrition_risk_assessment) ? data[0].malnutrition_risk_assessment : [data[0].malnutrition_risk_assessment];
    else records = data;
  } else if (data?.malnutrition_risk_assessment) records = Array.isArray(data.malnutrition_risk_assessment) ? data.malnutrition_risk_assessment : [data.malnutrition_risk_assessment];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Malnutrition Risk Assessment</Text>
          <Text style={styles.noData}>No malnutrition risk assessment records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Malnutrition Risk Assessment</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Malnutrition Risk Assessment ${rIdx + 1}`)}</Text>
            {hasVal(record.date) && <Text style={styles.recordMeta}>{safeString(formatDate(record.date))}</Text>}
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MalnutritionRiskAssessmentDocumentPDFTemplate;
