import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ParkinsonMedicationsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. non-zero; hide-zero) for JSX/PDF parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Nested objects (levodopa.*, amantadine.*) resolve via dotted paths; arrays-of-objects
 * (comtInhibitors, symptomatic, ...) decompose into a per-item subLabel header + each sub-field's
 * subLabel + value row (mirrors the JSX; never side-by-side).
 * No record date is rendered (the record has no real top-level date) - NEVER createdAt/updatedAt.
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
const SECTION_ORDER = ['general-info', 'dosing', 'duration-dates', 'levodopa', 'dopamine-agonists', 'mao-inhibitors', 'comt-inhibitors', 'anticholinergics', 'amantadine', 'symptomatic', 'safety'];

const SECTION_TITLES = {
  'general-info': 'General Information',
  'dosing': 'Dosing',
  'duration-dates': 'Duration & Dates',
  'levodopa': 'Levodopa',
  'dopamine-agonists': 'Dopamine Agonists',
  'mao-inhibitors': 'MAO-B Inhibitors',
  'comt-inhibitors': 'COMT Inhibitors',
  'anticholinergics': 'Anticholinergics',
  'amantadine': 'Amantadine',
  'symptomatic': 'Symptomatic Medications',
  'safety': 'Safety & Monitoring',
};

const FIELD_LABELS = {
  name: 'Medication Name',
  genericName: 'Generic Name',
  indication: 'Indication',
  prescriber: 'Prescriber',
  active: 'Active',
  dosage: 'Dosage',
  frequency: 'Frequency',
  route: 'Route',
  instructions: 'Instructions',
  startDate: 'Start Date',
  endDate: 'End Date',
  duration: 'Duration',
  durationDays: 'Duration (Days)',
  durationUnit: 'Duration Unit',
  refills: 'Refills',
  'levodopa.formulation': 'Formulation',
  'levodopa.totalDailyDose': 'Total Daily Dose',
  'levodopa.frequency': 'Frequency',
  'levodopa.timingWithMeals': 'Timing With Meals',
  'amantadine.dose': 'Dose',
  'amantadine.frequency': 'Frequency',
  anticholinergics: 'Anticholinergics',
  safetyWarning: 'Safety Warning',
  sideEffects: 'Side Effects',
  drugInteractions: 'Drug Interactions',
  ledEquivalent: 'LED Equivalent',
};

const SECTION_FIELDS = {
  'general-info': ['name', 'genericName', 'indication', 'prescriber', 'active'],
  'dosing': ['dosage', 'frequency', 'route', 'instructions'],
  'duration-dates': ['startDate', 'endDate', 'duration', 'durationDays', 'durationUnit', 'refills'],
  'levodopa': ['levodopa.formulation', 'levodopa.totalDailyDose', 'levodopa.frequency', 'levodopa.timingWithMeals'],
  'dopamine-agonists': ['dopamineAgonists'],
  'mao-inhibitors': ['maoInhibitors'],
  'comt-inhibitors': ['comtInhibitors'],
  'anticholinergics': ['anticholinergics'],
  'amantadine': ['amantadine.dose', 'amantadine.frequency'],
  'symptomatic': ['symptomatic'],
  'safety': ['safetyWarning', 'sideEffects', 'drugInteractions', 'ledEquivalent'],
};

const BOOLEAN_FIELDS = ['active'];
const DATE_FIELDS = ['startDate', 'endDate'];
const NUMBER_FIELDS = ['durationDays', 'refills'];
const ARRAY_FIELDS = ['sideEffects', 'drugInteractions'];
const OBJECT_ARRAY_FIELDS = ['dopamineAgonists', 'maoInhibitors', 'comtInhibitors', 'anticholinergics', 'symptomatic'];

/* HELPERS (mirror the JSX) - safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars) */
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const humanizeKey = (key) => {
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* Resolve nested dot-path values: "levodopa.formulation" -> record.levodopa.formulation */
const resolvePath = (obj, path) => {
  if (!obj || !path) return undefined;
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
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

/* Array-of-objects: each object -> subLabel header (Title #N) + each sub-field's subLabel + value */
const objectArrayRows = (title, items) => {
  const rows = [];
  (Array.isArray(items) ? items : []).forEach((item, i) => {
    if (item === null || item === undefined) return;
    if (typeof item !== 'object') { if (String(item).trim()) rows.push({ type: 'item', text: String(item) }); return; }
    const subs = Object.entries(item).filter(([k, v]) => hasVal(v) && k !== '_id');
    if (subs.length === 0) return;
    rows.push({ type: 'sub', text: `${title} #${i + 1}` });
    subs.forEach(([k, v]) => { rows.push({ type: 'sub', text: humanizeKey(k) }); rows.push({ type: 'item', text: fmtVal(v) }); });
  });
  return rows;
};

const fieldPresent = (record, f) => {
  const v = resolvePath(record, f);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(it => it && (typeof it !== 'object' ? String(it).trim() : Object.entries(it).some(([k, x]) => hasVal(x) && k !== '_id'))).length > 0;
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(Boolean).length > 0;
  if (NUMBER_FIELDS.includes(f)) return hasVal(v) && Number(v) !== 0; // hide-zero
  return hasVal(v);
};

const fieldBody = (record, f, sid) => {
  const v = resolvePath(record, f);
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    return objectArrayRows(SECTION_TITLES[sid] || FIELD_LABELS[f] || f, v).map((r, i) => r.type === 'sub'
      ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
      : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
  }
  if (ARRAY_FIELDS.includes(f)) {
    return (Array.isArray(v) ? v : []).filter(Boolean).map((it, i) => <Text key={i} style={styles.value}>{strip(String(it))}</Text>);
  }
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(v ? 'Yes' : 'No')}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return present.map((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const isObjArr = OBJECT_ARRAY_FIELDS.includes(f);
    const showLabel = !isObjArr && label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    return (
      <View key={f} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {fieldBody(record, f, sid)}
      </View>
    );
  });
};

const ParkinsonMedicationsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.parkinson_medications) records = Array.isArray(data[0].parkinson_medications) ? data[0].parkinson_medications : [data[0].parkinson_medications];
    else records = data;
  } else if (data?.parkinson_medications) records = Array.isArray(data.parkinson_medications) ? data.parkinson_medications : [data.parkinson_medications];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Parkinson Medications</Text>
          <Text style={styles.noData}>No Parkinson medications records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Parkinson Medications</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(record.name || `Parkinson Medications ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default ParkinsonMedicationsDocumentPDFTemplate;
