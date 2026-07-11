import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PainManagementPlanDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (dates, arrays, recommendations, results object,
 * split-sentence strings) for JSX/PDF field parity.
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
const SECTION_ORDER = ['record-info', 'current-analgesics', 'interventional-procedures', 'consultations', 'supportive-devices', 'radiation-therapy', 'clinical-details', 'recommendations', 'results', 'notes'];

const SECTION_TITLES = {
  'record-info': 'Record Info',
  'current-analgesics': 'Current Analgesics',
  'interventional-procedures': 'Interventional Procedures',
  'consultations': 'Consultations',
  'supportive-devices': 'Supportive Devices / Therapies',
  'radiation-therapy': 'Radiation Therapy',
  'clinical-details': 'Clinical Details',
  'recommendations': 'Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  currentAnalgesics: 'Current Analgesics',
  interventionalProcedures: 'Interventional Procedures',
  consultations: 'Consultations',
  supportiveDevices: 'Supportive Devices',
  radiationTherapy: 'Radiation Therapy',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility', 'status'],
  'current-analgesics': ['currentAnalgesics'],
  'interventional-procedures': ['interventionalProcedures'],
  'consultations': ['consultations'],
  'supportive-devices': ['supportiveDevices'],
  'radiation-therapy': ['radiationTherapy'],
  'clinical-details': ['findings', 'assessment', 'plan'],
  'recommendations': ['recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['currentAnalgesics', 'interventionalProcedures', 'consultations', 'supportiveDevices'];
const RECOMMENDATIONS_FIELD = 'recommendations';
const OBJECT_FIELDS = ['results'];

/* HELPERS (mirror the JSX) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2212/g, '-')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length > 0;
  if (typeof v === 'object') return !isEmptyDeep(v);
  return true;
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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

/* objectRows: flatten a dynamic-key object/array into bold sub-labels + plain value rows (results). */
const objectRows = (value, label, keyPrefix) => {
  const rows = [];
  if (isEmptyDeep(value)) return rows;
  if (isScalar(value)) {
    if (label) rows.push(<Text key={`${keyPrefix}-l`} style={styles.subLabel}>{safeString(humanizeKey(label))}</Text>);
    rows.push(<Text key={`${keyPrefix}-v`} style={styles.value}>{safeString(fmtScalar(value))}</Text>);
    return rows;
  }
  if (Array.isArray(value)) {
    if (label) rows.push(<Text key={`${keyPrefix}-l`} style={styles.subLabel}>{safeString(humanizeKey(label))}</Text>);
    value.filter(x => !isEmptyDeep(x)).forEach((it, i) => {
      if (isScalar(it)) rows.push(<Text key={`${keyPrefix}-${i}`} style={styles.value}>{safeString(fmtScalar(it))}</Text>);
      else objectRows(it, '', `${keyPrefix}-${i}`).forEach(r => rows.push(r));
    });
    return rows;
  }
  if (label) rows.push(<Text key={`${keyPrefix}-l`} style={styles.subLabel}>{safeString(humanizeKey(label))}</Text>);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    objectRows(v, k, `${keyPrefix}-${k}`).forEach(r => rows.push(r));
  });
  return rows;
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (f === RECOMMENDATIONS_FIELD) {
    const items = Array.isArray(v) ? v.filter(x => !isEmptyDeep(x)) : [];
    return items.map((item, i) => {
      const recText = typeof item === 'object' ? (item.recommendation || '') : String(item);
      const recDate = typeof item === 'object' && item.date ? ` (${formatDate(item.date)})` : '';
      return <Text key={i} style={styles.value}>{safeString(`${i + 1}. ${recText}${recDate}`)}</Text>;
    });
  }
  if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(v || {}).filter(([, x]) => !isEmptyDeep(x));
    const out = [];
    entries.forEach(([k, x]) => objectRows(x, k, `${f}-${k}`).forEach(r => out.push(r)));
    return out;
  }
  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(v) ? v.filter(x => !isEmptyDeep(x)) : [];
    const out = [];
    items.forEach((item, i) => {
      const p = parseLabel(String(item));
      if (p.isLabeled) {
        out.push(<Text key={`l${i}`} style={styles.subLabel}>{safeString(p.label)}</Text>);
        out.push(<Text key={`v${i}`} style={styles.value}>{strip(p.value)}</Text>);
      } else {
        out.push(<Text key={i} style={styles.value}>{safeString(String(item))}</Text>);
      }
    });
    return out;
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
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

const PainManagementPlanDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data.flatMap(item => {
      if (item?.pain_management_plan) return Array.isArray(item.pain_management_plan) ? item.pain_management_plan : [item.pain_management_plan];
      if (item?.documentData) { const dd = item.documentData; return Array.isArray(dd) ? dd : [dd]; }
      if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
      if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
      return [item];
    });
  } else if (data && typeof data === 'object') {
    if (data.document) records = Array.isArray(data.document) ? data.document : [data.document];
    else if (data.data) records = Array.isArray(data.data) ? data.data : [data.data];
    else records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pain Management Plans</Text>
          <Text style={styles.noData}>No pain management plan records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pain Management Plans</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Pain Management Plan ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PainManagementPlanDocumentPDFTemplate;
