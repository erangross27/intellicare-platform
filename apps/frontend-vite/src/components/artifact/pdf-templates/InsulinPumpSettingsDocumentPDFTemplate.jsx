import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * InsulinPumpSettingsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * basalRates / carbRatios / recommendations = arrays of objects → each object decomposes into a
 * subLabel (primary sub-field) + value row(s) for the remaining sub-fields (never side-by-side);
 * each array item is its OWN wrap=false block so a long array flows across pages intact.
 * results = nested object → recursive leaf rows (subLabel path + value). notes = long narrative →
 * splitBySentence + parseLabel. Record date is record.date — NEVER createdAt/updatedAt.
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
const SECTION_ORDER = ['session-info', 'pump-config', 'basal-rates', 'carb-ratios', 'results', 'clinical-notes', 'recommendations', 'additional-notes'];

const SECTION_TITLES = {
  'session-info': 'Session Information',
  'pump-config': 'Pump Configuration',
  'basal-rates': 'Basal Rates',
  'carb-ratios': 'Carb Ratios',
  'results': 'Results',
  'clinical-notes': 'Clinical Notes',
  'recommendations': 'Recommendations',
  'additional-notes': 'Additional Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  pumpModel: 'Pump Model',
  totalBasal: 'Total Basal',
  correctionFactor: 'Correction Factor',
  targetGlucose: 'Target Glucose',
  activeInsulinTime: 'Active Insulin Time',
  maxBolus: 'Max Bolus',
  maxBasalRate: 'Max Basal Rate',
  basalRates: 'Basal Rates',
  carbRatios: 'Carb Ratios',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'pump-config': ['pumpModel', 'totalBasal', 'correctionFactor', 'targetGlucose', 'activeInsulinTime', 'maxBolus', 'maxBasalRate'],
  'basal-rates': ['basalRates'],
  'carb-ratios': ['carbRatios'],
  'results': ['results'],
  'clinical-notes': ['findings', 'assessment', 'plan'],
  'recommendations': ['recommendations'],
  'additional-notes': ['notes'],
};

const DATE_FIELDS = ['date'];
const LONG_TEXT_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const OBJECT_ARRAY_FIELDS = ['basalRates', 'carbRatios', 'recommendations'];
const OBJECT_FIELDS = ['results'];

const BASAL_RATE_SUB_FIELDS = [{ key: 'timeRange', label: 'Time Range' }, { key: 'rate', label: 'Rate' }];
const CARB_RATIO_SUB_FIELDS = [{ key: 'time', label: 'Time' }, { key: 'ratio', label: 'Ratio' }];
const RECOMMENDATION_SUB_FIELDS = [{ key: 'recommendation', label: 'Recommendation' }, { key: 'date', label: 'Date', isDate: true }];
const getArraySubFields = (fn) => (fn === 'basalRates' ? BASAL_RATE_SUB_FIELDS : fn === 'carbRatios' ? CARB_RATIO_SUB_FIELDS : fn === 'recommendations' ? RECOMMENDATION_SUB_FIELDS : []);

/* HELPERS (mirror the JSX) — safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars) */
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

/* results object → recursive leaf rows: { label: dotted path, value: leaf } */
const objectLeafData = (obj) => {
  const leaves = [];
  const walk = (o, path) => {
    if (o === null || o === undefined) return;
    if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${path}[${i + 1}]`)); }
    else if (typeof o === 'object') { Object.entries(o).forEach(([k, v]) => walk(v, path ? `${path} - ${k}` : k)); }
    else { const s = String(o); if (s.trim() !== '') leaves.push({ label: path, value: s }); }
  };
  walk(obj, '');
  return leaves;
};

/* array-of-objects → one row-group per item: primary sub-field = subLabel, remaining = value rows */
const arrayItemRowGroups = (val, fn) => {
  const subFields = getArraySubFields(fn);
  const items = (Array.isArray(val) ? val : [])
    .map(it => (it && typeof it === 'object') ? it : (fn === 'recommendations' ? { recommendation: it } : { value: it }))
    .filter(it => subFields.some(sf => String(it[sf.key] ?? '').trim()));
  return items.map(item => {
    const rows = [];
    subFields.forEach((sf, j) => {
      const raw = String(item[sf.key] ?? '').trim();
      if (!raw) return;
      const disp = sf.isDate ? formatDate(raw) : raw;
      rows.push(j === 0
        ? <Text key={`p${j}`} style={styles.subLabel}>{safeString(disp)}</Text>
        : <Text key={`v${j}`} style={styles.value}>{safeString(disp)}</Text>);
    });
    return rows;
  });
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const subFields = getArraySubFields(f);
    return Array.isArray(v) && v.some(it => { const o = (it && typeof it === 'object') ? it : { recommendation: it }; return subFields.some(sf => String(o[sf.key] ?? '').trim()); });
  }
  if (OBJECT_FIELDS.includes(f)) return v && typeof v === 'object' && objectLeafData(v).length > 0;
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (OBJECT_FIELDS.includes(f)) return objectLeafData(v).flatMap((leaf, i) => ([
    <Text key={`l${i}`} style={styles.subLabel}>{safeString(leaf.label)}</Text>,
    <Text key={`v${i}`} style={styles.value}>{safeString(leaf.value)}</Text>,
  ]));
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = (SECTION_FIELDS[sid] || []).filter(f => fieldPresent(record, f));
  if (fields.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  const blocks = [];
  fields.forEach((f, fi) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    if (OBJECT_ARRAY_FIELDS.includes(f)) {
      const groups = arrayItemRowGroups(record[f], f);
      groups.forEach((rows, gi) => {
        blocks.push(
          <View key={`${f}-${gi}`} style={styles.fieldWrap} wrap={false}>
            {fi === 0 && gi === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
            {showLabel && gi === 0 && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
            {rows}
          </View>
        );
      });
    } else {
      blocks.push(
        <View key={f} style={styles.fieldWrap} wrap={false}>
          {fi === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
          {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
          {fieldBody(record, f)}
        </View>
      );
    }
  });
  return <View key={sid}>{blocks}</View>;
};

const InsulinPumpSettingsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.insulin_pump_settings) records = Array.isArray(data[0].insulin_pump_settings) ? data[0].insulin_pump_settings : [data[0].insulin_pump_settings];
    else records = data;
  } else if (data?.insulin_pump_settings) records = Array.isArray(data.insulin_pump_settings) ? data.insulin_pump_settings : [data.insulin_pump_settings];
  else if (data?.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) records = dd;
    else if (dd?.insulin_pump_settings) records = Array.isArray(dd.insulin_pump_settings) ? dd.insulin_pump_settings : [dd.insulin_pump_settings];
    else if (dd && typeof dd === 'object') records = [dd];
  } else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Insulin Pump Settings</Text>
          <Text style={styles.noData}>No insulin pump settings records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Insulin Pump Settings</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Insulin Pump Settings ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default InsulinPumpSettingsDocumentPDFTemplate;
