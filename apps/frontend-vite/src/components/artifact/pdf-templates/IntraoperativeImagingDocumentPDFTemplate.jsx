import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * IntraoperativeImagingDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Nested cholangiography.* is resolved via resolvePath (dotted field paths); nested objects
 * (fluoroscopy/ultrasound/results) decompose recursively via objectRows; recommendations is an
 * array-of-objects. Record date is the record's own `date` — NEVER createdAt/updatedAt.
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
const SECTION_ORDER = ['session-info', 'cholangiography', 'imaging-modalities', 'results', 'clinical-notes', 'recommendations'];

const SECTION_TITLES = {
  'session-info': 'Session Information',
  'cholangiography': 'Cholangiography',
  'imaging-modalities': 'Imaging Modalities',
  'results': 'Results',
  'clinical-notes': 'Clinical Notes',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'cholangiography.performed': 'Performed',
  'cholangiography.normal': 'Normal',
  'cholangiography.findings': 'Findings',
  'cholangiography.contrastInjectionSite': 'Contrast Injection Site',
  fluoroscopy: 'Fluoroscopy',
  ultrasound: 'Ultrasound',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'cholangiography': ['cholangiography.performed', 'cholangiography.normal', 'cholangiography.findings', 'cholangiography.contrastInjectionSite'],
  'imaging-modalities': ['fluoroscopy', 'ultrasound'],
  'results': ['results'],
  'clinical-notes': ['findings', 'assessment', 'plan', 'notes'],
  'recommendations': ['recommendations'],
};

const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['cholangiography.performed', 'cholangiography.normal'];
const LONG_STRING_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const NESTED_OBJECT_FIELDS = ['fluoroscopy', 'ultrasound'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

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
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* resolvePath: read a dotted field path (e.g. "cholangiography.performed") off the record */
const resolvePath = (record, f) => {
  if (!f.includes('.')) return record[f];
  return f.split('.').reduce((o, k) => (o == null ? undefined : o[k]), record);
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

/* objectRows: recursive decomposition for nested objects (results / fluoroscopy / ultrasound):
   each key → a subLabel then its scalar value (or recurse), never side-by-side "Key: value". */
const objectRows = (obj, keyPrefix = 'o') => {
  const rows = [];
  Object.entries(obj || {}).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    if (isScalar(v)) {
      rows.push(<Text key={`${keyPrefix}-${k}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      rows.push(<Text key={`${keyPrefix}-${k}-v`} style={styles.value}>{safeString(fmtScalar(v))}</Text>);
    } else if (Array.isArray(v)) {
      rows.push(<Text key={`${keyPrefix}-${k}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach((it, i) => {
        if (isScalar(it)) rows.push(<Text key={`${keyPrefix}-${k}-${i}`} style={styles.value}>{safeString(fmtScalar(it))}</Text>);
        else objectRows(it, `${keyPrefix}-${k}-${i}`).forEach(r => rows.push(r));
      });
    } else {
      rows.push(<Text key={`${keyPrefix}-${k}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      objectRows(v, `${keyPrefix}-${k}`).forEach(r => rows.push(r));
    }
  });
  return rows;
};

/* recommendations array-of-objects: each object → subLabel (recommendation text) + formatted date */
const recommendationRows = (val) => {
  const items = (Array.isArray(val) ? val : []).filter(r => (r?.recommendation || '').trim());
  return items.map((rec, i) => {
    const recText = safeString((rec?.recommendation || '').trim());
    const recDate = (rec?.date || '').trim();
    return (
      <View key={i}>
        <Text style={styles.subLabel}>{recText}</Text>
        {recDate ? <Text style={styles.value}>{safeString(formatDate(recDate))}</Text> : null}
      </View>
    );
  });
};

const fieldPresent = (record, f) => {
  const v = resolvePath(record, f);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(r => (r?.recommendation || '').trim()).length > 0;
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = resolvePath(record, f);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return recommendationRows(v);
  if (OBJECT_FIELDS.includes(f) || NESTED_OBJECT_FIELDS.includes(f)) return objectRows(v, f);
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (LONG_STRING_FIELDS.includes(f)) {
    const rows = sentenceRows(String(v));
    if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
    return rows.map((r, i) => r.type === 'sub'
      ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
      : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
  }
  return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
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

const IntraoperativeImagingDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.intraoperative_imaging) records = Array.isArray(data[0].intraoperative_imaging) ? data[0].intraoperative_imaging : [data[0].intraoperative_imaging];
    else records = data;
  } else if (data?.intraoperative_imaging) records = Array.isArray(data.intraoperative_imaging) ? data.intraoperative_imaging : [data.intraoperative_imaging];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Intraoperative Imaging</Text>
          <Text style={styles.noData}>No intraoperative imaging records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Intraoperative Imaging</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Intraoperative Imaging ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default IntraoperativeImagingDocumentPDFTemplate;
