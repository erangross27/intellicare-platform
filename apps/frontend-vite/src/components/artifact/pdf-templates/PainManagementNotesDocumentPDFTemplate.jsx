import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PainManagementNotesDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers respect hide-zero) for JSX/PDF parity.
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
const SECTION_ORDER = ['overview', 'pain-profile', 'scores', 'medications', 'function-exam', 'interventions'];

const SECTION_TITLES = {
  'overview': 'Overview',
  'pain-profile': 'Pain Profile',
  'scores': 'Disability & Pain Scores',
  'medications': 'Medications & Opioid Risk',
  'function-exam': 'Functional & Physical Exam',
  'interventions': 'Interventional Procedures',
};

const FIELD_LABELS = {
  painScaleScore: 'Pain Scale Score (0-10)',
  painLocation: 'Pain Location',
  painQuality: 'Pain Quality',
  painDurationDays: 'Pain Duration (days)',
  oswestryDisabilityIndex: 'Oswestry Disability Index (%)',
  rolandMorrisScore: 'Roland-Morris Disability Score',
  briefPainInventoryScore: 'Brief Pain Inventory Score',
  painInterferenceScore: 'Pain Interference Score',
  catastrophizingScale: 'Pain Catastrophizing Scale',
  centralSensitizationInventory: 'Central Sensitization Inventory',
  neuropathicPainScale: 'Neuropathic Pain Scale',
  sleepDisturbanceScore: 'Sleep Disturbance Score',
  currentMedicationList: 'Current Medications',
  morphineEquivalentDose: 'Morphine Equivalent Daily Dose (MED)',
  opioidRiskToolScore: 'Opioid Risk Tool Score',
  functionalCapacityEvaluation: 'Functional Capacity Evaluation',
  rangeOfMotionDegrees: 'Range of Motion (degrees)',
  muscleStrengthGrade: 'Muscle Strength Grade',
  neurodynamicTesting: 'Neurodynamic Testing',
  triggerPointLocations: 'Trigger Point Locations',
  interventionalProcedures: 'Interventional Procedures',
  injectionSite: 'Injection Site',
  medicationVolumeMl: 'Medication Volume (mL)',
  fluoroscopyTime: 'Fluoroscopy Time (min)',
};

const SECTION_FIELDS = {
  'overview': ['painScaleScore'],
  'pain-profile': ['painLocation', 'painQuality', 'painDurationDays'],
  'scores': ['oswestryDisabilityIndex', 'rolandMorrisScore', 'briefPainInventoryScore', 'painInterferenceScore', 'catastrophizingScale', 'centralSensitizationInventory', 'neuropathicPainScale', 'sleepDisturbanceScore'],
  'medications': ['currentMedicationList', 'morphineEquivalentDose', 'opioidRiskToolScore'],
  'function-exam': ['functionalCapacityEvaluation', 'rangeOfMotionDegrees', 'muscleStrengthGrade', 'neurodynamicTesting', 'triggerPointLocations'],
  'interventions': ['interventionalProcedures', 'injectionSite', 'medicationVolumeMl', 'fluoroscopyTime'],
};

const NUMBER_FIELDS = ['painScaleScore', 'painDurationDays', 'oswestryDisabilityIndex', 'rolandMorrisScore', 'briefPainInventoryScore', 'painInterferenceScore', 'catastrophizingScale', 'centralSensitizationInventory', 'neuropathicPainScale', 'sleepDisturbanceScore', 'morphineEquivalentDose', 'opioidRiskToolScore', 'rangeOfMotionDegrees', 'medicationVolumeMl', 'fluoroscopyTime'];
const ARRAY_FIELDS = ['painLocation', 'painQuality', 'currentMedicationList', 'triggerPointLocations', 'interventionalProcedures'];
const COMMA_LIST_FIELDS = ['functionalCapacityEvaluation'];
const DATE_FIELDS = [];

/* MEANINGFUL_ZERO_FIELDS: 0 is a valid clinical finding (no pain / opioid-free / no ORT risk),
   NOT a "not-recorded" sentinel - must render even at 0 (UI parity). The remaining instrument
   scores use 0 as an "instrument-not-administered" sentinel and stay hidden unless doctor-edited. */
const MEANINGFUL_ZERO_FIELDS = ['painScaleScore', 'morphineEquivalentDose', 'opioidRiskToolScore'];

/* HELPERS (mirror the JSX) - safeString regex uses \uXXXX escapes ONLY (ASCII source) */
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

/* hide-zero: numeric "not recorded" (0) hidden unless meaningful-zero or doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) {
    if (MEANINGFUL_ZERO_FIELDS.includes(key)) return true;
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  }
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

/* fieldBody: number -> bare value; array -> numbered list; comma-list -> numbered list; else sentence rows */
const fieldBody = (record, f) => {
  const v = record[f];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).filter(Boolean);
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(String(it))}</Text>);
  }
  if (COMMA_LIST_FIELDS.includes(f)) {
    const items = splitByComma(String(v)).map(s => s.trim()).filter(Boolean);
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

/* field presence respecting hide-zero */
const fieldPresent = (record, f) => {
  if (NUMBER_FIELDS.includes(f)) return numberShowsPDF(record, f);
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

/* ======= COMPONENT ======= */
const PainManagementNotesDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  let arr = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : []);
  records = arr.flatMap(r => {
    if (r?.pain_management_notes) return Array.isArray(r.pain_management_notes) ? r.pain_management_notes : [r.pain_management_notes];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pain_management_notes) return Array.isArray(dd.pain_management_notes) ? dd.pain_management_notes : [dd.pain_management_notes]; return [dd]; }
    return [r];
  }).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pain Management Notes</Text>
          <Text style={styles.noData}>No pain management notes data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pain Management Notes</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Pain Management Notes ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PainManagementNotesDocumentPDFTemplate;
