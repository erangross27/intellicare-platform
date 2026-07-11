import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * HivHistoryDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0) for JSX/PDF field parity.
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
const SECTION_ORDER = ['session-info', 'diagnosis-details', 'cd4-history', 'genotype-resistance', 'prior-ois', 'art-history', 'clinical-notes', 'results-section', 'recommendations-section'];

const SECTION_TITLES = {
  'session-info': 'Session Information',
  'diagnosis-details': 'Diagnosis Details',
  'cd4-history': 'CD4 History',
  'genotype-resistance': 'Genotype Resistance',
  'prior-ois': 'Prior Opportunistic Infections',
  'art-history': 'ART History',
  'clinical-notes': 'Clinical Notes',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  diagnosisDate: 'Diagnosis Date',
  provider: 'Provider',
  facility: 'Facility',
  diagnosisContext: 'Diagnosis Context',
  transmissionRoute: 'Transmission Route',
  status: 'Status',
  nadirCD4: 'Nadir CD4',
  bestCD4: 'Best CD4',
  genotype: 'Genotype',
  priorOIs: 'Prior Opportunistic Infections',
  artHistory: 'ART History',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  results: 'Results',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'diagnosisDate', 'provider', 'facility'],
  'diagnosis-details': ['diagnosisContext', 'transmissionRoute', 'status'],
  'cd4-history': ['nadirCD4', 'bestCD4'],
  'genotype-resistance': ['genotype'],
  'prior-ois': ['priorOIs'],
  'art-history': ['artHistory'],
  'clinical-notes': ['findings', 'assessment', 'plan', 'notes'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
};

const DATE_FIELDS = ['date', 'diagnosisDate'];
const ARRAY_FIELDS = ['genotype', 'priorOIs', 'artHistory'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

const KEY_OVERRIDES = {
  cd4: 'CD4', cd8: 'CD8', hiv: 'HIV', art: 'ART', oi: 'OI', ois: 'OIs',
  rna: 'RNA', dna: 'DNA', pcr: 'PCR', id: 'ID', msm: 'MSM', ivdu: 'IVDU',
};

/* HELPERS (mirror the JSX) — safeString uses ONLY \uXXXX escapes (never raw special chars).
   μ (Greek mu, as in "98 cells/uL") is normalized to µ (micro sign) which Helvetica renders. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u03BC/g, '\u00B5')
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

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
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

/* objectRows: generic recursive renderer for a nested object (results). scalar leaves render inline
   "Key: value" (allowed in the PDF); arrays -> numbered items; nested objects -> subLabel + recurse. */
const objectRows = (obj, kp) => {
  const rows = [];
  Object.entries(obj || {}).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const key = `${kp}-${k}-${i}`;
    if (isScalar(v)) {
      rows.push(<Text key={key} style={styles.value}>{safeString(`${humanizeKey(k)}: ${fmtScalar(v)}`)}</Text>);
    } else if (Array.isArray(v)) {
      rows.push(<Text key={`${key}s`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach((it, j) => {
        if (isScalar(it)) rows.push(<Text key={`${key}i${j}`} style={styles.value}>{safeString(`${j + 1}. ${fmtScalar(it)}`)}</Text>);
        else objectRows(it, `${key}i${j}`).forEach(r => rows.push(r));
      });
    } else {
      rows.push(<Text key={`${key}s`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      objectRows(v, key).forEach(r => rows.push(r));
    }
  });
  return rows;
};

/* recommendationRows: array of {recommendation, date}, date-grouped (mirrors the JSX). */
const recommendationRows = (arr) => {
  const recs = (Array.isArray(arr) ? arr : []).filter(r => r && !isEmptyDeep(r.recommendation));
  const rows = []; let lastDate = null; let n = 1;
  recs.forEach((rec, i) => {
    const d = (rec?.date || '').trim();
    if (d && d !== lastDate) { rows.push(<Text key={`d${i}`} style={styles.subLabel}>{safeString(d)}</Text>); lastDate = d; }
    rows.push(<Text key={`r${i}`} style={styles.value}>{safeString(`${n++}. ${strip(rec.recommendation)}`)}</Text>);
  });
  return rows;
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).filter(x => !isEmptyDeep(x));
    return items.map((it, i) => <Text key={i} style={styles.value}>{safeString(`${i + 1}. ${strip(it)}`)}</Text>);
  }
  if (OBJECT_ARRAY_FIELDS.includes(f)) return recommendationRows(v);
  if (OBJECT_FIELDS.includes(f)) return objectRows(v, f);
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
    // single-name gate + array fields carry no field sublabel (items ride under the section title, mirrors JSX)
    const showLabel = !ARRAY_FIELDS.includes(f) && label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    return (
      <View key={f} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {fieldBody(record, f)}
      </View>
    );
  });
};

const HivHistoryDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>HIV History</Text>
          <Text style={styles.noData}>No HIV history records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>HIV History</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`HIV History ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default HivHistoryDocumentPDFTemplate;
