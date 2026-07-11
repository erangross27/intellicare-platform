import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MedicationsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS. Mirrors the JSX field
 * handling: booleans (prn/active) -> Yes/No (false shown), numbers (refills/durationDays) -> hidden
 * when 0, dates -> long form, sideEffects -> numbered list, drugInteractions -> recursive nested
 * (skipped entirely when every leaf is 0/empty), narratives -> per-sentence rows. JSX/PDF parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  groupTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordSub: { fontSize: 12, color: '#333333', marginBottom: 6 },
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
const SECTION_ORDER = ['med-info', 'prescription', 'clinical', 'side-effects', 'safety'];

const SECTION_TITLES = {
  'med-info': 'Medication Information',
  'prescription': 'Prescription Details',
  'clinical': 'Clinical Information',
  'side-effects': 'Side Effects',
  'safety': 'Safety Alerts & Drug Interactions',
};

const FIELD_LABELS = {
  name: 'Name',
  genericName: 'Generic Name',
  dosage: 'Dosage',
  originalDosage: 'Original Dosage',
  form: 'Form',
  frequency: 'Frequency',
  route: 'Route',
  maxDailyDose: 'Max Daily Dose',
  prescriber: 'Prescriber',
  quantity: 'Quantity',
  refills: 'Refills',
  duration: 'Duration',
  durationDays: 'Duration (Days)',
  durationUnit: 'Duration Unit',
  startDate: 'Start Date',
  endDate: 'End Date',
  prn: 'PRN (As Needed)',
  active: 'Active',
  indication: 'Indication',
  usage: 'Usage',
  instructions: 'Instructions',
  taperInstructions: 'Taper Instructions',
  sideEffects: 'Side Effects',
  safetyWarning: 'Safety Warning',
  drugInteractions: 'Drug Interactions',
  status: 'Status',
};

const SECTION_FIELDS = {
  'med-info': ['dosage', 'originalDosage', 'form', 'frequency', 'route', 'maxDailyDose'],
  'prescription': ['prescriber', 'quantity', 'refills', 'duration', 'durationDays', 'durationUnit', 'startDate', 'endDate', 'prn', 'active'],
  'clinical': ['indication', 'usage', 'instructions', 'taperInstructions'],
  'side-effects': ['sideEffects'],
  'safety': ['safetyWarning', 'drugInteractions'],
};

const NUMBER_FIELDS = ['refills', 'durationDays'];
const BOOLEAN_FIELDS = ['prn', 'active'];
const DATE_FIELDS = ['startDate', 'endDate'];
const ARRAY_FIELDS = ['sideEffects'];
const OBJECT_FIELDS = ['drugInteractions'];

const KEY_OVERRIDES = {
  totalInteractions: 'Total Interactions',
  contraindicated: 'Contraindicated',
  major: 'Major',
  moderate: 'Moderate',
  minor: 'Minor',
  interactions: 'Interactions',
  interactsWith: 'Interacts With',
  severity: 'Severity',
  description: 'Description',
  source: 'Source',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

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

const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return v === 0 || !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const boolText = (v) => ((v === true || v === 'true') ? 'Yes' : 'No');

const fieldHasVal = (fn, v) => {
  if (BOOLEAN_FIELDS.includes(fn)) return typeof v === 'boolean' || v === 'true' || v === 'false';
  if (NUMBER_FIELDS.includes(fn)) { const n = Number(v); return v !== null && v !== undefined && v !== '' && !isNaN(n) && n !== 0; }
  if (DATE_FIELDS.includes(fn)) return v !== null && v !== undefined && v !== '';
  if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => !isEmptyDeep(x)).length > 0;
  if (OBJECT_FIELDS.includes(fn)) return !isScalar(v) && !isEmptyDeep(v);
  return v !== null && v !== undefined && String(v).trim() !== '';
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return safeString(dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(dateValue); }
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

/* recursive nested object node (drugInteractions), hide-empty */
const renderObjectNode = (label, value, keyPath) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPath} style={{ marginBottom: 3 }}>
        <Text style={styles.subLabel}>{safeString(label)}</Text>
        <Text style={styles.value}>{safeString(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath} style={{ marginBottom: 3 }}>
      {label ? <Text style={styles.subLabel}>{safeString(label)}</Text> : null}
      <View style={{ marginLeft: 10 }}>
        {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}.${k}`))}
      </View>
    </View>
  );
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{boolText(v)}</Text>];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).filter(x => !isEmptyDeep(x));
    return items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>);
  }
  if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(v).filter(([, val]) => !isEmptyDeep(val));
    return entries.map(([k, val]) => renderObjectNode(humanizeKey(k), val, `${f}.${k}`));
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

const isActiveMed = (med) => {
  const status = (med.status || 'active').toLowerCase();
  return status !== 'discontinued' && status !== 'stopped' && status !== 'inactive';
};

const renderMedication = (med, key) => {
  const subBits = [];
  if (med.genericName) subBits.push(safeString(med.genericName));
  if (med.status) subBits.push(safeString(med.status));
  if (med.prn === true || med.prn === 'true') subBits.push('PRN');
  return (
    <View key={key}>
      <View wrap={false}>
        <Text style={styles.recordTitle}>{safeString(med.name) || 'Unnamed Medication'}</Text>
        {subBits.length > 0 ? <Text style={styles.recordSub}>{subBits.join('  |  ')}</Text> : null}
      </View>
      {SECTION_ORDER.map(sid => renderSection(med, sid))}
    </View>
  );
};

const MedicationsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let raw = [];
  if (Array.isArray(data)) {
    if (data.length && data[0] && data[0].records) raw = data[0].records;
    else if (data.length && data[0] && data[0].medications) raw = data[0].medications;
    else raw = data;
  } else if (data && data.records) raw = data.records;
  else if (data && data.medications) raw = data.medications;
  else if (data) raw = [data];

  const records = (Array.isArray(raw) ? raw : [])
    .filter(r => r && typeof r === 'object')
    .map(record => {
      const clean = {};
      for (const k of Object.keys(record)) { if (!k.startsWith('_')) clean[k] = record[k]; }
      return clean;
    });

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Medications</Text>
          <Text style={styles.noData}>No medication records available.</Text>
        </Page>
      </Document>
    );
  }

  const activeMeds = records.filter(isActiveMed);
  const discontinuedMeds = records.filter(m => !isActiveMed(m));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Medications</Text>
        {activeMeds.length > 0 && (
          <View>
            <Text style={styles.groupTitle}>{safeString(`Active Medications (${activeMeds.length})`)}</Text>
            {activeMeds.map((med, i) => renderMedication(med, `a-${i}`))}
          </View>
        )}
        {discontinuedMeds.length > 0 && (
          <View>
            <Text style={styles.groupTitle} break={activeMeds.length > 0}>{safeString(`Discontinued Medications (${discontinuedMeds.length})`)}</Text>
            {discontinuedMeds.map((med, i) => renderMedication(med, `d-${i}`))}
          </View>
        )}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MedicationsDocumentPDFTemplate;
