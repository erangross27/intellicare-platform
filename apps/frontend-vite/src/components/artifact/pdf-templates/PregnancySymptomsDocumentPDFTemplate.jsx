/**
 * PregnancySymptomsDocumentPDFTemplate.jsx
 * Box-free BLACK & WHITE LETTER PDF — pregnancy symptoms.
 * Underline-rule hierarchy (no boxes): documentTitle (2pt) > sectionTitle (1pt) > fieldLabel (0.5pt, bare).
 * Config-driven field renderer flattened to small elements + anti-orphan section (title glued to first element).
 * Mirrors PregnancySymptomsDocument.jsx: 11 sections, STRING_FIELDS, COMMA_SPLIT_FIELDS=['notes'],
 *   DATE_FIELDS=['date'], ARRAY_FIELDS=['skinChanges'], OBJECT_FIELDS=['results'] (recursive),
 *   OBJECT_ARRAY_FIELDS=['recommendations'] (date-grouped), sameAsTitle single-name gate.
 * Collection: pregnancy_symptoms
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 6 },
  fieldLabel: { fontSize: 13, color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  recDate: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

/* printable-only scrub: × → x + smart quotes/dashes/ellipsis normalized (no zero-width strip). */
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
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* paren-protected sentence split (mirrors the JSX; char-code consts, no literal control chars) */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const P1 = String.fromCharCode(1), P2 = String.fromCharCode(2);
  let depth = 0, masked = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; masked += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); masked += ch; }
    else if (depth > 0 && ch === '.') masked += P1;
    else if (depth > 0 && ch === ';') masked += P2;
    else masked += ch;
  }
  return masked
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(s => s.split(P1).join('.').split(P2).join(';').replace(/^\d+\.\s+/, '').trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* parenthesis-aware comma split with thousands/year guard (mirrors the JSX) */
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

/* ======= SECTIONS CONFIG ======= */
const SECTION_TITLES = {
  'symptom-info': 'Symptom Information',
  'gastrointestinal': 'Gastrointestinal Symptoms',
  'musculoskeletal': 'Musculoskeletal Symptoms',
  'circulatory-skin': 'Circulatory & Skin',
  'other-symptoms': 'Other Symptoms',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'plan-notes': 'Plan & Notes',
  'notes-status': 'Status',
};

const SECTION_FIELDS = {
  'symptom-info': ['date', 'provider', 'facility'],
  'gastrointestinal': ['nausea', 'vomiting', 'heartburn', 'constipation', 'hemorrhoids'],
  'musculoskeletal': ['backPain', 'roundLigamentPain'],
  'circulatory-skin': ['edema', 'varicoseVeins', 'skinChanges'],
  'other-symptoms': ['sleepDisturbance', 'urinaryFrequency', 'vaginalDischarge'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'plan-notes': ['plan', 'notes'],
  'notes-status': ['status'],
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  nausea: 'Nausea',
  vomiting: 'Vomiting',
  heartburn: 'Heartburn',
  constipation: 'Constipation',
  hemorrhoids: 'Hemorrhoids',
  backPain: 'Back Pain',
  roundLigamentPain: 'Round Ligament Pain',
  edema: 'Edema',
  varicoseVeins: 'Varicose Veins',
  skinChanges: 'Skin Changes',
  sleepDisturbance: 'Sleep Disturbance',
  urinaryFrequency: 'Urinary Frequency',
  vaginalDischarge: 'Vaginal Discharge',
  findings: 'Findings',
  assessment: 'Assessment',
  results: 'Results',
  recommendations: 'Recommendations',
  plan: 'Plan',
  notes: 'Notes',
  status: 'Status',
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['skinChanges'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const STRING_FIELDS = ['provider', 'facility', 'nausea', 'vomiting', 'heartburn', 'constipation', 'hemorrhoids', 'backPain', 'roundLigamentPain', 'edema', 'varicoseVeins', 'sleepDisturbance', 'urinaryFrequency', 'vaginalDischarge', 'findings', 'assessment', 'plan', 'notes', 'status'];
const COMMA_SPLIT_FIELDS = ['notes'];
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

/* ======= FLAT ELEMENT PRODUCERS (bare labels; parity mirrors the JSX Copy) ======= */
/* recursive object → flat elements (scalar leaf STACKS label then value; object header carries colon) */
const objectNodeElements = (label, value, keyPrefix) => {
  const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) {
    if (label) out.push(<Text key={`${keyPrefix}-l`} style={styles.subLabel}>{safeString(label)}</Text>);
    out.push(<Text key={`${keyPrefix}-v`} style={styles.value}>{safeString(fmtScalar(value))}</Text>);
    return out;
  }
  if (label) out.push(<Text key={`${keyPrefix}-l`} style={styles.subLabel}>{safeString(label)}:</Text>);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    out.push(...objectNodeElements(humanizeKey(k), v, `${keyPrefix}-${k}`));
  });
  return out;
};

/* multi-sentence string → flat elements (mirrors formatSentenceFieldLines, single running counter) */
const sentenceElements = (text, keyPrefix) => {
  const sentences = splitBySentence(text);
  const out = []; let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      out.push(<Text key={`${keyPrefix}-s${si}-l`} style={styles.subLabel}>{safeString(parsed.label)}:</Text>);
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        parts.forEach((item, ii) => out.push(<Text key={`${keyPrefix}-s${si}-p${ii}`} style={styles.listItem}>{n++}. {safeString(item)}</Text>));
      } else {
        out.push(<Text key={`${keyPrefix}-s${si}-v`} style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>);
      }
    } else {
      out.push(<Text key={`${keyPrefix}-s${si}`} style={styles.listItem}>{n++}. {safeString(s)}</Text>);
    }
  });
  return out;
};

/* one field → flat array of small elements (bare label + body); label gated by sameAsTitle */
const fieldElements = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = !sameAsTitle(label, sid);
  const out = [];
  if (showLabel) out.push(<Text key={`${f}-lbl`} style={styles.fieldLabel}>{label}</Text>);

  if (DATE_FIELDS.includes(f)) {
    out.push(<Text key={`${f}-v`} style={styles.value}>{formatDate(val)}</Text>);
    return out;
  }

  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [val];
    if (items.length === 0) return [];
    items.forEach((item, i) => out.push(<Text key={`${f}-i${i}`} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>));
    return out;
  }

  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return [];
    let lastDate = null; let n = 1;
    recs.forEach((r, ri) => {
      const rec = (r?.recommendation || '').trim();
      const date = (r?.date || '').trim();
      if (date !== lastDate) { if (date) out.push(<Text key={`${f}-d${ri}`} style={styles.recDate}>{safeString(date)}</Text>); lastDate = date; n = 1; }
      out.push(<Text key={`${f}-r${ri}`} style={styles.listItem}>{n++}. {safeString(rec)}</Text>);
    });
    return out;
  }

  if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    entries.forEach(([k, v]) => out.push(...objectNodeElements(humanizeKey(k), v, `${f}-${k}`)));
    return out;
  }

  /* STRING */
  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);
  const commaParts = splitByComma(strVal);
  if (COMMA_SPLIT_FIELDS.includes(f) && sentences.length <= 1 && !parseLabel(strVal).isLabeled && commaParts.length >= 2) {
    commaParts.forEach((p, i) => out.push(<Text key={`${f}-c${i}`} style={styles.listItem}>{i + 1}. {safeString(p)}</Text>));
    return out;
  }
  if (sentences.length > 1) {
    out.push(...sentenceElements(strVal, f));
    return out;
  }
  out.push(<Text key={`${f}-v`} style={styles.value}>{strVal}</Text>);
  return out;
};

/* ======= SECTION RENDERER (anti-orphan: sectionTitle glued to first element) ======= */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];

  const els = [];
  present.forEach(f => { els.push(...fieldElements(record, f, sid)); });
  if (els.length === 0) return null;

  const [first, ...rest] = els;
  return (
    <View key={sid} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const PregnancySymptomsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.pregnancy_symptoms) {
    records = Array.isArray(data.pregnancy_symptoms) ? data.pregnancy_symptoms : [data.pregnancy_symptoms];
  } else if (data?.documentData?.pregnancy_symptoms) {
    records = Array.isArray(data.documentData.pregnancy_symptoms) ? data.documentData.pregnancy_symptoms : [data.documentData.pregnancy_symptoms];
  } else if (data?.documentData) {
    records = Array.isArray(data.documentData) ? data.documentData : [data.documentData];
  } else if (data && typeof data === 'object') {
    records = [data];
  }
  records = records.filter(r => r && typeof r === 'object' && Object.keys(r).length > 0);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pregnancy Symptoms</Text>
          </View>
          <Text style={styles.noDataText}>No pregnancy symptoms records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Pregnancy Symptoms</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Pregnancy Symptoms {idx + 1}</Text>
            </View>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PregnancySymptomsDocumentPDFTemplate;
