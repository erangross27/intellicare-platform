import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free B&W LETTER PDF — bare underlined labels above values, no boxes/shading.
   Config-driven to mirror PregnancyRiskAssessmentDocument.jsx exactly. */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', marginBottom: 16 },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, color: '#000000', marginBottom: 3 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, paddingLeft: 8 },
});

/* ═══════ CONFIG (mirror of the JSX) ═══════ */
const SECTION_TITLES = {
  'clinical-info': 'Clinical Information',
  'risk-assessment': 'Risk Assessment',
  'consultations': 'Consultations Needed',
  'surveillance': 'Surveillance Plan',
  'clinical-findings': 'Clinical Findings',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  riskLevel: 'Risk Level', riskFactors: 'Risk Factors',
  consultationsNeeded: 'Consultations Needed',
  surveillancePlan: 'Surveillance Plan', hospitalOfDelivery: 'Hospital of Delivery', antenatalTesting: 'Antenatal Testing',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', results: 'Results', notes: 'Notes', status: 'Status',
};
const SECTION_FIELDS = {
  'clinical-info': ['date', 'provider', 'facility'],
  'risk-assessment': ['riskLevel', 'riskFactors'],
  'consultations': ['consultationsNeeded'],
  'surveillance': ['surveillancePlan', 'hospitalOfDelivery', 'antenatalTesting'],
  'clinical-findings': ['findings', 'assessment', 'plan', 'results', 'recommendations', 'notes', 'status'],
};
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['riskFactors', 'consultationsNeeded'];
const STRING_FIELDS = ['provider', 'facility', 'riskLevel', 'surveillancePlan', 'hospitalOfDelivery', 'findings', 'assessment', 'plan', 'notes', 'status'];
const NESTED_ARRAY_FIELDS = ['antenatalTesting'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const COMMA_SPLIT_FIELDS = ['surveillancePlan'];
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

/* ═══════ HELPERS ═══════ */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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

/* safeString: printable-only scrub (× → x, smart quotes/dashes/ellipsis → ascii). NO zero-width/space strip. */
const safeString = (s) => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  // paren-protect '.'/';' inside parentheses (via char-code consts — no literal control chars)
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

/* recursive object → flat array of small elements (subLabel heading + numbered value rows) */
const objectNodeElements = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return [];
  const out = [];
  if (isScalar(value)) {
    if (label) out.push(<Text key={`${keyPath}-l`} style={styles.subLabel}>{safeString(label)}</Text>);
    out.push(<Text key={`${keyPath}-v`} style={styles.listItem}>{safeString(fmtScalar(value))}</Text>);
    return out;
  }
  if (label) out.push(<Text key={`${keyPath}-l`} style={styles.subLabel}>{safeString(label)}</Text>);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectNodeElements(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1)));
  return out;
};

/* multi-sentence string → flat elements (mirror of formatSentenceFieldLines): labeled → subLabel + numbered
   comma items; unlabeled → numbered listItem. Single running counter across all sentences. */
const sentenceElements = (text, keyPrefix) => {
  const out = [];
  const sentences = splitBySentence(text);
  let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      out.push(<Text key={`${keyPrefix}-s${si}-l`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) parts.forEach((item, ii) => out.push(<Text key={`${keyPrefix}-s${si}-p${ii}`} style={styles.listItem}>{n++}. {safeString(item)}</Text>));
      else out.push(<Text key={`${keyPrefix}-s${si}-v`} style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>);
    } else {
      out.push(<Text key={`${keyPrefix}-s${si}`} style={styles.listItem}>{n++}. {safeString(s)}</Text>);
    }
  });
  return out;
};

/* one field → flat array of small elements (bare label above value(s)) */
const fieldElements = (record, f, sid, keyPrefix) => {
  const val = record[f];
  if (isEmptyDeep(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = !sameAsTitle(label, sid);
  const els = [];
  const pushLabel = () => { if (showLabel) els.push(<Text key={`${keyPrefix}-lbl`} style={styles.fieldLabel}>{safeString(label)}</Text>); };

  if (DATE_FIELDS.includes(f)) {
    pushLabel();
    els.push(<Text key={`${keyPrefix}-v`} style={styles.value}>{formatDate(val)}</Text>);
  } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
    if (recs.length === 0) return [];
    pushLabel();
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    groups.forEach((g, gi) => {
      if (g.date) els.push(<Text key={`${keyPrefix}-g${gi}-d`} style={styles.subLabel}>{safeString(g.date)}</Text>);
      g.items.forEach((r, ri) => els.push(<Text key={`${keyPrefix}-g${gi}-r${ri}`} style={styles.listItem}>{ri + 1}. {safeString(String(r?.recommendation || '').trim())}</Text>));
    });
  } else if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    pushLabel();
    entries.forEach(([k, v]) => els.push(...objectNodeElements(humanizeKey(k), v, `${keyPrefix}-${k}`, 1)));
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [val];
    if (items.length === 0) return [];
    pushLabel();
    items.forEach((item, i) => els.push(<Text key={`${keyPrefix}-a${i}`} style={styles.listItem}>{i + 1}. {safeString(String(item))}</Text>));
  } else if (NESTED_ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [val];
    if (items.length === 0) return [];
    pushLabel();
    items.forEach((item, i) => {
      const testName = item?.test || item?.type || '';
      const freq = item?.frequency || '';
      const startAt = item?.startingAt ? ` (starting at ${item.startingAt})` : '';
      els.push(<Text key={`${keyPrefix}-n${i}`} style={styles.listItem}>{i + 1}. {safeString(`${testName}: ${freq}${startAt}`)}</Text>);
    });
  } else if (STRING_FIELDS.includes(f)) {
    const strVal = fmtScalar(val);
    const sentences = splitBySentence(strVal);
    const commaParts = splitByComma(strVal);
    if (COMMA_SPLIT_FIELDS.includes(f) && sentences.length <= 1 && !parseLabel(strVal).isLabeled && commaParts.length >= 2) {
      pushLabel();
      commaParts.forEach((p, i) => els.push(<Text key={`${keyPrefix}-c${i}`} style={styles.listItem}>{i + 1}. {safeString(p)}</Text>));
    } else if (sentences.length > 1) {
      pushLabel();
      els.push(...sentenceElements(strVal, keyPrefix));
    } else {
      pushLabel();
      els.push(<Text key={`${keyPrefix}-v`} style={styles.value}>{safeString(strVal)}</Text>);
    }
  } else {
    pushLabel();
    els.push(<Text key={`${keyPrefix}-v`} style={styles.value}>{safeString(fmtScalar(val))}</Text>);
  }
  return els;
};

/* section with anti-orphan: flatten to els, glue sectionTitle + first el in a wrap={false} View, rest flow */
const renderSection = (record, idx, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const els = [];
  fields.forEach(f => { els.push(...fieldElements(record, f, sid, `${sid}-${idx}-${f}`)); });
  if (els.length === 0) return null;
  const [first, ...rest] = els;
  return (
    <View key={sid} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(SECTION_TITLES[sid])}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const PregnancyRiskAssessmentDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0].records) rawRecords = data[0].records;
    else rawRecords = data;
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data) {
    rawRecords = [data];
  }

  // Clean records - remove injected underscore-prefixed fields from JSX filtering
  const records = rawRecords.map(record => {
    if (!record || typeof record !== 'object') return record;
    const cleanRecord = {};
    for (const key of Object.keys(record)) if (!key.startsWith('_')) cleanRecord[key] = record[key];
    return cleanRecord;
  });

  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pregnancy Risk Assessment</Text>
          <Text style={styles.value}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pregnancy Risk Assessment</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>Pregnancy Risk Assessment {idx + 1}</Text>
            </View>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, idx, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PregnancyRiskAssessmentDocumentPDFTemplate;
