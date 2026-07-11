import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MedicationAccessProgramsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Arrays-of-objects (programsEnrolled/applicationsPending) + arrays-of-strings render via a generic
 * recursive renderer (objectRows/arrayRows/fieldBody); inline "Key: value" is allowed in the PDF only.
 * NO record date - the record has only createdAt/updatedAt (ingestion timestamps), never a clinical date.
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
const SECTION_ORDER = ['summary-info', 'programs-enrolled', 'applications-pending', 'access-strategies', 'programs-eligible', 'barriers', 'notes'];

const SECTION_TITLES = {
  'summary-info': 'Summary',
  'programs-enrolled': 'Programs Enrolled',
  'applications-pending': 'Applications Pending',
  'access-strategies': 'Alternative Access Strategies',
  'programs-eligible': 'Programs Eligible',
  'barriers': 'Barriers',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  totalMonthlySavings: 'Total Monthly Savings',
  socialWorkReferral: 'Social Work Referral',
  programsEnrolled: 'Programs Enrolled',
  applicationsPending: 'Applications Pending',
  alternativeAccessStrategies: 'Alternative Access Strategies',
  programsEligible: 'Programs Eligible',
  barriers: 'Barriers',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'summary-info': ['totalMonthlySavings', 'socialWorkReferral'],
  'programs-enrolled': ['programsEnrolled'],
  'applications-pending': ['applicationsPending'],
  'access-strategies': ['alternativeAccessStrategies'],
  'programs-eligible': ['programsEligible'],
  'barriers': ['barriers'],
  'notes': ['notes'],
};

const BOOLEAN_FIELDS = ['socialWorkReferral'];
const NUMBER_FIELDS = [];
const DATE_FIELDS = [];

/* HELPERS (mirror the JSX) - safeString uses ONLY \uXXXX escapes (never literal smart-quotes/invisible chars) */
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

const KEY_OVERRIDES = {
  adap: 'ADAP', aids: 'AIDS', hiv: 'HIV', id: 'ID',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const lower = String(key).toLowerCase();
  if (KEY_OVERRIDES[lower]) return KEY_OVERRIDES[lower];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.split(' ').map(w => { const l = w.toLowerCase(); return KEY_OVERRIDES[l] || (w.charAt(0).toUpperCase() + w.slice(1)); }).join(' ');
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const fmtScalar = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(s)) return formatDate(s);
  return s;
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length > 0;
  if (typeof v === 'object') return !isEmptyDeep(v);
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

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma (decompose nested "Label: value") */
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

/* objectRows: generic recursive renderer for nested objects (inline "Key: value" allowed in PDF) */
const objectRows = (obj, kp) => {
  const rows = [];
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const key = `${kp}-${k}-${i}`;
    if (isScalar(v)) {
      rows.push(<Text key={key} style={styles.value}>{safeString(`${humanizeKey(k)}: ${fmtScalar(v)}`)}</Text>);
    } else if (Array.isArray(v)) {
      rows.push(<Text key={`${key}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach((it, j) => rows.push(
        isScalar(it)
          ? <Text key={`${key}-${j}`} style={styles.value}>{`${j + 1}. ${strip(fmtScalar(it))}`}</Text>
          : <View key={`${key}-${j}`}>{objectRows(it, `${key}-${j}`)}</View>
      ));
    } else {
      rows.push(<Text key={`${key}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      rows.push(...objectRows(v, key));
    }
  });
  return rows;
};

/* arrayRows: array of scalars -> decompose labeled items (subLabel above value), number the rest.
   Array-of-objects -> each object decomposes via objectRows. */
const arrayRows = (arr, kp) => {
  const rows = [];
  arr.filter(x => !isEmptyDeep(x)).forEach((item, i) => {
    if (!isScalar(item)) { rows.push(<View key={`${kp}-${i}`}>{objectRows(item, `${kp}-${i}`)}</View>); return; }
    const p = parseLabel(fmtScalar(item));
    if (p.isLabeled) {
      rows.push(<Text key={`${kp}-${i}-l`} style={styles.subLabel}>{safeString(p.label)}</Text>);
      rows.push(<Text key={`${kp}-${i}-v`} style={styles.value}>{strip(p.value)}</Text>);
    } else {
      rows.push(<Text key={`${kp}-${i}`} style={styles.value}>{`${i + 1}. ${strip(fmtScalar(item))}`}</Text>);
    }
  });
  return rows;
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (Array.isArray(v)) return arrayRows(v, f);
  if (v && typeof v === 'object') return objectRows(v, f);
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

const MedicationAccessProgramsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.medication_access_programs) records = Array.isArray(data[0].medication_access_programs) ? data[0].medication_access_programs : [data[0].medication_access_programs];
    else records = data;
  } else if (data?.medication_access_programs) records = Array.isArray(data.medication_access_programs) ? data.medication_access_programs : [data.medication_access_programs];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Medication Access Programs</Text>
          <Text style={styles.noData}>No medication access programs records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Medication Access Programs</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Medication Access Programs ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MedicationAccessProgramsDocumentPDFTemplate;
