import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * InsulinTimingInstructionsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. real values, hiding sentinel 0s;
 * the slidingScaleProtocol string-array) for JSX/PDF field parity.
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
const SECTION_ORDER = ['insulin-overview', 'dosing', 'administration-timing', 'pharmacokinetics', 'glucose-targets', 'sliding-scale', 'meal-timing', 'injection-site', 'exercise', 'sick-day', 'storage'];

const SECTION_TITLES = {
  'insulin-overview': 'Insulin Overview',
  'dosing': 'Dosing',
  'administration-timing': 'Administration Timing',
  'pharmacokinetics': 'Pharmacokinetics',
  'glucose-targets': 'Blood Glucose Targets',
  'sliding-scale': 'Sliding Scale Protocol',
  'meal-timing': 'Meal Timing Instructions',
  'injection-site': 'Injection Site Rotation',
  'exercise': 'Exercise Adjustments',
  'sick-day': 'Sick Day Management',
  'storage': 'Storage Instructions',
};

const FIELD_LABELS = {
  insulinType: 'Insulin Type',
  insulinBrandName: 'Insulin Brand Name',
  insulinDeliveryMethod: 'Insulin Delivery Method',
  basalInsulinDosage: 'Basal Insulin Dosage (units)',
  bolusInsulinDosage: 'Bolus Insulin Dosage (units)',
  correctionFactor: 'Correction Factor',
  carbohydrateRatio: 'Carbohydrate Ratio',
  basalAdministrationTime: 'Basal Administration Time',
  premealTimingMinutes: 'Pre-Meal Timing (minutes)',
  prandialInsulinTiming: 'Prandial Insulin Timing',
  dawnPhenomenonAdjustment: 'Dawn Phenomenon Adjustment',
  onsetOfAction: 'Onset of Action',
  peakActionTime: 'Peak Action Time',
  durationOfAction: 'Duration of Action',
  targetBloodGlucoseRange: 'Target Blood Glucose Range',
  hypoglycemiaThreshold: 'Hypoglycemia Threshold (mg/dL)',
  glucoseMonitoringFrequency: 'Glucose Monitoring Frequency',
  slidingScaleProtocol: 'Sliding Scale Protocol',
  mealTimingInstructions: 'Meal Timing Instructions',
  injectionSiteRotation: 'Injection Site Rotation',
  exerciseAdjustments: 'Exercise Adjustments',
  sickDayManagement: 'Sick Day Management',
  insulinStorageInstructions: 'Insulin Storage Instructions',
};

const SECTION_FIELDS = {
  'insulin-overview': ['insulinType', 'insulinBrandName', 'insulinDeliveryMethod'],
  'dosing': ['basalInsulinDosage', 'bolusInsulinDosage', 'correctionFactor', 'carbohydrateRatio'],
  'administration-timing': ['basalAdministrationTime', 'premealTimingMinutes', 'prandialInsulinTiming', 'dawnPhenomenonAdjustment'],
  'pharmacokinetics': ['onsetOfAction', 'peakActionTime', 'durationOfAction'],
  'glucose-targets': ['targetBloodGlucoseRange', 'hypoglycemiaThreshold', 'glucoseMonitoringFrequency'],
  'sliding-scale': ['slidingScaleProtocol'],
  'meal-timing': ['mealTimingInstructions'],
  'injection-site': ['injectionSiteRotation'],
  'exercise': ['exerciseAdjustments'],
  'sick-day': ['sickDayManagement'],
  'storage': ['insulinStorageInstructions'],
};

const NUMBER_FIELDS = ['basalInsulinDosage', 'bolusInsulinDosage', 'correctionFactor', 'premealTimingMinutes', 'hypoglycemiaThreshold'];
const ARRAY_FIELDS = ['slidingScaleProtocol'];
/* Numeric fields whose 0 is a "not set" sentinel (no field has a meaningful zero) — hidden when 0.
   Mirrors NUMBER_FIELDS / MEANINGFUL_ZERO_FIELDS in InsulinTimingInstructionsDocument.jsx. */
const SENTINEL_ZERO_FIELDS = new Set(['basalInsulinDosage', 'bolusInsulinDosage', 'correctionFactor', 'premealTimingMinutes', 'hypoglycemiaThreshold']);

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

const fieldHasVal = (key, v) => {
  if (SENTINEL_ZERO_FIELDS.has(key)) {
    if (v === null || v === undefined || v === '') return false;
    const n = parseFloat(v); if (isNaN(n)) return false; return n !== 0;
  }
  return hasVal(v);
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

/* arrayRows: each array item -> parseLabel ("BG range: dose" → sub-label + value); unlabeled items stay whole. */
const arrayRows = (items) => {
  const rows = [];
  (Array.isArray(items) ? items : []).forEach(item => {
    const p = parseLabel(String(item));
    if (p.isLabeled) { rows.push({ type: 'sub', text: p.label }); rows.push({ type: 'item', text: p.value }); }
    else rows.push({ type: 'item', text: String(item) });
  });
  return rows;
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  const rows = ARRAY_FIELDS.includes(f) ? arrayRows(v) : sentenceRows(String(v));
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

const InsulinTimingInstructionsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.flatMap(r => {
    if (r?.insulin_timing_instructions) return Array.isArray(r.insulin_timing_instructions) ? r.insulin_timing_instructions : [r.insulin_timing_instructions];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.insulin_timing_instructions) return Array.isArray(dd.insulin_timing_instructions) ? dd.insulin_timing_instructions : [dd.insulin_timing_instructions]; return [dd]; }
    return [r];
  }).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Insulin Timing Instructions</Text>
          <Text style={styles.noData}>No insulin timing instructions records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Insulin Timing Instructions</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Insulin Timing Instructions ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default InsulinTimingInstructionsDocumentPDFTemplate;
