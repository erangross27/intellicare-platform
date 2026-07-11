import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ImmediateRecommendationsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0, booleans as Yes/No) for JSX/PDF
 * parity — hide-zero mirrors the JSX (the 6 vitals/critical-values hide an exact 0).
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * This schema has NO date field — the record header shows ONLY the numbered record title.
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
const SECTION_ORDER = ['urgency-overview', 'protocol-activations', 'airway-circulation-support', 'critical-values-vitals', 'medication-discontinuation', 'monitoring-plan'];

const SECTION_TITLES = {
  'urgency-overview': 'Urgency Overview',
  'protocol-activations': 'Protocol Activations',
  'airway-circulation-support': 'Airway, Breathing & Circulation',
  'critical-values-vitals': 'Critical Values & Vital Parameters',
  'medication-discontinuation': 'Medication Discontinuation',
  'monitoring-plan': 'Monitoring Plan',
};

const FIELD_LABELS = {
  urgentReferralRequired: 'Urgent Referral Required',
  emergentInterventionNeeded: 'Emergent Intervention Needed',
  criticalValueAlert: 'Critical Value Alert',
  sepsisBundleInitiation: 'Sepsis Bundle Initiation',
  strokeCodeActivation: 'Stroke Code Activation',
  stemiProtocolActivation: 'STEMI Protocol Activation',
  insulinDripInitiation: 'Insulin Drip Initiation',
  airwayManagementNeeded: 'Airway Management Needed',
  mechanicalVentilationConsideration: 'Mechanical Ventilation Consideration',
  vasopressorRequirement: 'Vasopressor Requirement',
  transfusionRequirement: 'Transfusion Requirement',
  anticoagulationReversal: 'Anticoagulation Reversal',
  dialysisConsultation: 'Dialysis Consultation',
  glasgowComaScale: 'Glasgow Coma Scale',
  systolicBloodPressure: 'Systolic Blood Pressure (mmHg)',
  oxygenSaturation: 'Oxygen Saturation (%)',
  troponinLevel: 'Troponin Level (ng/mL)',
  creatinineLevel: 'Creatinine Level (mg/dL)',
  potassiumLevel: 'Potassium Level (mEq/L)',
  medicationDiscontinuation: 'Medication Discontinuation',
  acuteSymptomMonitoring: 'Acute Symptom Monitoring',
  cardiacMonitoringDuration: 'Cardiac Monitoring Duration',
  neurologicalChecksFrequency: 'Neurological Checks Frequency',
};

const SECTION_FIELDS = {
  'urgency-overview': ['urgentReferralRequired', 'emergentInterventionNeeded', 'criticalValueAlert'],
  'protocol-activations': ['sepsisBundleInitiation', 'strokeCodeActivation', 'stemiProtocolActivation', 'insulinDripInitiation'],
  'airway-circulation-support': ['airwayManagementNeeded', 'mechanicalVentilationConsideration', 'vasopressorRequirement', 'transfusionRequirement', 'anticoagulationReversal', 'dialysisConsultation'],
  'critical-values-vitals': ['glasgowComaScale', 'systolicBloodPressure', 'oxygenSaturation', 'troponinLevel', 'creatinineLevel', 'potassiumLevel'],
  'medication-discontinuation': ['medicationDiscontinuation'],
  'monitoring-plan': ['acuteSymptomMonitoring', 'cardiacMonitoringDuration', 'neurologicalChecksFrequency'],
};

const NUMBER_FIELDS = ['glasgowComaScale', 'systolicBloodPressure', 'oxygenSaturation', 'troponinLevel', 'creatinineLevel', 'potassiumLevel'];
const BOOLEAN_FIELDS = ['urgentReferralRequired', 'emergentInterventionNeeded', 'sepsisBundleInitiation', 'strokeCodeActivation', 'stemiProtocolActivation', 'insulinDripInitiation', 'airwayManagementNeeded', 'mechanicalVentilationConsideration', 'dialysisConsultation'];
const ARRAY_FIELDS = ['medicationDiscontinuation'];
const SENTENCE_FIELDS = ['criticalValueAlert', 'vasopressorRequirement', 'transfusionRequirement', 'anticoagulationReversal', 'acuteSymptomMonitoring', 'cardiacMonitoringDuration', 'neurologicalChecksFrequency'];
/* HIDE_ZERO mirrors the JSX: ALL 6 numerics — an exact 0 is "not measured / not flagged"
   (GCS minimum is 3; potassium 0 mEq/L and oxygen saturation 0% are incompatible with
   measurement; SBP 0 / troponin 0 / creatinine 0 are extraction sentinels).
   Real decimals (e.g. creatinineLevel 0.78) still display. */
const HIDE_ZERO_FIELDS = ['glasgowComaScale', 'systolicBloodPressure', 'oxygenSaturation', 'troponinLevel', 'creatinineLevel', 'potassiumLevel'];
const DATE_FIELDS = [];

/* HELPERS (mirror the JSX) — safeString regex uses ONLY \uXXXX escapes (never literal smart chars) */
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

/* arrItemText: same array-item stringification as the JSX (4-AREA RULE) */
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
      const hasOxford = items.some(ci => ci.trim().toLowerCase().startsWith('and '));
      if (items.length >= 2 && !hasOxford) {
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
    const items = (Array.isArray(v) ? v : []).map(arrItemText).filter(Boolean);
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const fieldHasVal = (record, f) => {
  const v = record[f];
  if (HIDE_ZERO_FIELDS.includes(f) && v === 0) return false;
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.some(item => arrItemText(item));
  return hasVal(v);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldHasVal(record, f));
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

const ImmediateRecommendationsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  const src = docProp || data;
  let records = [];
  if (src) {
    let arr = Array.isArray(src) ? src : [src];
    arr = arr.flatMap(r => {
      if (r?.immediate_recommendations) return Array.isArray(r.immediate_recommendations) ? r.immediate_recommendations : [r.immediate_recommendations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.immediate_recommendations) return Array.isArray(dd.immediate_recommendations) ? dd.immediate_recommendations : [dd.immediate_recommendations]; return [dd]; }
      return [r];
    });
    records = arr.filter(r => r && typeof r === 'object');
  }

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Immediate Recommendations</Text>
          <Text style={styles.noData}>No immediate recommendations records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Immediate Recommendations</Text>
        {records.map((record, rIdx) => {
          const recordNum = (record._originalIdx ?? rIdx) + 1;
          return (
            <View key={rIdx}>
              {/* NO date field in this schema — record header shows ONLY the numbered record title */}
              <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Immediate Recommendations ${recordNum}`)}</Text>
              {SECTION_ORDER.map(sid => renderSection(record, sid))}
            </View>
          );
        })}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default ImmediateRecommendationsDocumentPDFTemplate;
