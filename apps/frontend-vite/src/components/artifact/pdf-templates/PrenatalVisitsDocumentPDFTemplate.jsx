/**
 * PrenatalVisitsDocumentPDFTemplate.jsx
 * Box-free B&W underline theme — Helvetica — LETTER size — prenatal visits
 * Collection: prenatal_visits
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 20 },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8, marginTop: 6 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= CONFIG (mirrors the JSX template) ======= */
const SECTION_TITLES = {
  'visit-info': 'Visit Information',
  'pregnancy-details': 'Pregnancy Details',
  'vital-signs': 'Vital Signs',
  'fetal-assessment': 'Fetal Assessment',
  'cervical-exam': 'Cervical Exam',
  'ultrasound-findings': 'Ultrasound Findings',
  'lab-results': 'Lab Results',
  'complications-plan': 'Complications and Plan',
};

const FIELD_LABELS = {
  visitDate: 'Visit Date',
  gestationalAge: 'Gestational Age',
  lmp: 'LMP (Last Menstrual Period)',
  edd: 'EDD (Estimated Due Date)',
  gravida: 'Gravida',
  para: 'Para',
  weight: 'Weight',
  bloodPressure: 'Blood Pressure',
  fundalHeight: 'Fundal Height',
  fetalHeartRate: 'Fetal Heart Rate',
  fetalMovement: 'Fetal Movement',
  cervicalExam: 'Cervical Exam',
  'ultrasoundFindings.presentation': 'Presentation',
  'ultrasoundFindings.FHR': 'Fetal Heart Rate (US)',
  'ultrasoundFindings.AFI': 'Amniotic Fluid Index',
  'ultrasoundFindings.placenta': 'Placenta',
  'ultrasoundFindings.EFW': 'Estimated Fetal Weight',
  'ultrasoundFindings.umbilicalArteryDoppler': 'Umbilical Artery Doppler',
  labResults: 'Lab Results',
  complications: 'Complications',
  plan: 'Plan',
};

const SECTION_FIELDS = {
  'visit-info': ['visitDate', 'gestationalAge'],
  'pregnancy-details': ['lmp', 'edd', 'gravida', 'para'],
  'vital-signs': ['weight', 'bloodPressure'],
  'fetal-assessment': ['fundalHeight', 'fetalHeartRate', 'fetalMovement'],
  'cervical-exam': ['cervicalExam'],
  'ultrasound-findings': ['ultrasoundFindings.presentation', 'ultrasoundFindings.FHR', 'ultrasoundFindings.AFI', 'ultrasoundFindings.placenta', 'ultrasoundFindings.EFW', 'ultrasoundFindings.umbilicalArteryDoppler'],
  'lab-results': ['labResults'],
  'complications-plan': ['complications', 'plan'],
};

const DATE_FIELDS = ['visitDate', 'lmp', 'edd'];
const NUMBER_FIELDS = ['gravida', 'para'];
const ARRAY_FIELDS = ['labResults', 'complications'];
const OBJECT_FIELDS = ['cervicalExam'];

/* ======= UTILS ======= */
const KEY_OVERRIDES = { fhr: 'FHR', afi: 'AFI', efw: 'EFW', us: 'US', bpm: 'BPM', cm: 'cm' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  else s = String(val);
  return s
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
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
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

/* getVal: resolve dot-path fields like ultrasoundFindings.presentation */
const getVal = (record, f) => {
  if (!f.includes('.')) return record[f];
  let val = record;
  for (const p of f.split('.')) { if (val == null) return undefined; val = val[p]; }
  return val;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* formatSentenceLines: mirror of the JSX formatSentenceFieldLines (single running counter per field) */
const formatSentenceLines = (text) => {
  const sentences = splitBySentence(text);
  const lines = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      lines.push({ type: 'subtitle', text: safeString(parsed.label) });
      if (parts.length >= 2) {
        parts.forEach(item => lines.push({ type: 'item', text: safeString(item), num: n++ }));
      } else {
        lines.push({ type: 'item', text: safeString(parsed.value), num: n++ });
      }
    } else {
      lines.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });
  return lines;
};

/* objectElements: recursive flat <Text> list for a nested object (sub-label + value stacked) */
const objectElements = (value, keyBase, depth) => {
  if (isEmptyDeep(value)) return [];
  if (isScalar(value)) return [<Text key={keyBase} style={styles.fieldValue}>{safeString(fmtScalar(value))}</Text>];
  const out = [];
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    out.push(<Text key={`${keyBase}-${k}-l`} style={styles.subLabel}>{humanizeKey(k)}</Text>);
    if (isScalar(v)) out.push(<Text key={`${keyBase}-${k}-v`} style={styles.fieldValue}>{safeString(fmtScalar(v))}</Text>);
    else objectElements(v, `${keyBase}-${k}`, depth + 1).forEach(el => out.push(el));
  });
  return out;
};

/* fieldView: one bare <View fieldBox> per field, or null when empty/hidden */
const fieldView = (record, f, sid, key) => {
  const label = FIELD_LABELS[f] || f;
  const val = getVal(record, f);

  if (DATE_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    );
  }

  if (NUMBER_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{safeString(fmtScalar(val))}</Text>
      </View>
    );
  }

  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(x => hasVal(x)) : [];
    if (items.length === 0) return null;
    return (
      <View key={key} style={styles.fieldBox}>
        {!sameAsTitle(label, sid) && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
      </View>
    );
  }

  if (OBJECT_FIELDS.includes(f)) {
    if (!val || isScalar(val) || isEmptyDeep(val)) return null;
    const els = objectElements(val, `${key}-obj`, 1);
    if (els.length === 0) return null;
    return (
      <View key={key} style={styles.fieldBox}>
        {!sameAsTitle(label, sid) && <Text style={styles.fieldLabel}>{label}</Text>}
        {els}
      </View>
    );
  }

  /* STRING (and any other scalar) */
  if (!hasVal(val)) return null;
  const strVal = safeString(fmtVal(val));
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    const lines = formatSentenceLines(strVal);
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {lines.map((ln, i) => ln.type === 'subtitle'
          ? <Text key={i} style={styles.subLabel}>{ln.text}</Text>
          : <Text key={i} style={styles.listItem}>{ln.num}. {ln.text}</Text>)}
      </View>
    );
  }
  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

/* renderSection: anti-orphan — glue the section title + first visible field inside one wrap={false} View */
const renderSection = (record, sid, keyBase) => {
  const fields = SECTION_FIELDS[sid] || [];
  const views = fields.map((f, i) => fieldView(record, f, sid, `${keyBase}-${sid}-${i}`)).filter(Boolean);
  if (views.length === 0) return null;
  const [first, ...rest] = views;
  return (
    <View key={`${keyBase}-${sid}`} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

/* ======= COMPONENT ======= */
const PrenatalVisitsDocumentPDFTemplate = ({ document: doc }) => {
  let records = [];
  if (Array.isArray(doc)) records = doc;
  else if (doc?.prenatal_visits) records = Array.isArray(doc.prenatal_visits) ? doc.prenatal_visits : [doc.prenatal_visits];
  else if (doc?.documentData?.prenatal_visits) records = Array.isArray(doc.documentData.prenatal_visits) ? doc.documentData.prenatal_visits : [doc.documentData.prenatal_visits];
  else if (doc?.documentData) records = Array.isArray(doc.documentData) ? doc.documentData : [doc.documentData];
  else if (doc && typeof doc === 'object') records = [doc];
  records = records.filter(r => r && Object.keys(r).length > 0);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Prenatal Visits</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Prenatal Visits</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Prenatal Visit ${index + 1}`}</Text>
            </View>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid, index))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrenatalVisitsDocumentPDFTemplate;
