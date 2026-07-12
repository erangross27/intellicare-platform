/**
 * PreventiveCareDocumentPDFTemplate.jsx
 * Box-free B&W — LETTER — Collection: preventive_care
 * Mirrors PreventiveCareDocument.jsx (7 sections, immunizations object, results object,
 * recommendations object-array, sameAsTitle bare labels, paren-protected [.;] split, anti-orphan glue).
 * date renders in the general-info section (no header date/provider).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ═══════ BOX-FREE B&W STYLES ═══════ */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordCard: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, color: '#333333', marginTop: 6, marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, marginBottom: 3, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
});

/* ═══════ CONFIG MAPS (mirror the JSX) ═══════ */
const IMMUNIZATION_LABELS = {
  influenza: 'Influenza', pneumococcal: 'Pneumococcal', covid19: 'COVID-19', zoster: 'Zoster', other: 'Other',
};
const humanizeKey = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const SECTION_CONFIGS = [
  {
    title: 'Cancer Screenings',
    fields: [
      { key: 'colonoscopyDueAge', label: 'Colonoscopy', kind: 'string' },
      { key: 'mammographyStatus', label: 'Mammography', kind: 'string' },
      { key: 'cervicalScreeningStatus', label: 'Cervical Screening', kind: 'string' },
      { key: 'lungCancerScreening', label: 'Lung Cancer Screening', kind: 'string' },
      { key: 'prostateCancerScreening', label: 'Prostate Cancer Screening', kind: 'string' },
      { key: 'aaaScreening', label: 'AAA Screening', kind: 'string' },
    ],
  },
  {
    title: 'Mental Health & Substance Use Screenings',
    fields: [
      { key: 'depressionScreening', label: 'Depression Screening', kind: 'string' },
      { key: 'alcoholScreening', label: 'Alcohol Screening', kind: 'string' },
    ],
  },
  {
    title: 'Immunizations',
    fields: [
      { key: 'immunizations', label: 'Immunizations', kind: 'object', immun: true },
    ],
  },
  {
    title: 'General Information',
    fields: [
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'type', label: 'Type', kind: 'string' },
      { key: 'provider', label: 'Provider', kind: 'string' },
      { key: 'facility', label: 'Facility', kind: 'string' },
    ],
  },
  {
    title: 'Clinical Details',
    fields: [
      { key: 'findings', label: 'Findings', kind: 'string' },
      { key: 'assessment', label: 'Assessment', kind: 'string' },
      { key: 'plan', label: 'Plan', kind: 'string' },
    ],
  },
  {
    title: 'Recommendations',
    fields: [
      { key: 'recommendations', label: 'Recommendations', kind: 'recommendations' },
    ],
  },
  {
    title: 'Results & Notes',
    fields: [
      { key: 'results', label: 'Results', kind: 'object' },
      { key: 'notes', label: 'Notes', kind: 'string' },
      { key: 'status', label: 'Status', kind: 'string' },
    ],
  },
];

/* sameAsTitle: hide a field label that duplicates its section title */
const sameAsTitle = (label, title) => (label || '').trim().toLowerCase() === (title || '').trim().toLowerCase();

/* ═══════ HELPERS ═══════ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object') {
    if (val.$date) return formatDate(val.$date);
    if (Object.keys(val).length === 0) return '';
    if (val.value !== undefined) s = String(val.value);
    else if (val.text !== undefined) s = String(val.text);
    else s = JSON.stringify(val);
  } else s = String(val);
  return s
    .replace(/×/g, 'x')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...');
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

function formatDate(dateValue) {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    if (isNaN(date.getTime())) return String(dateValue || '');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue || ''); }
}

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  /* paren-protect: mask '.' and ';' inside parentheses so the [.;] split never breaks a parenthetical */
  const P1 = String.fromCharCode(1), P2 = String.fromCharCode(2);
  let masked = ''; let depth = 0;
  for (const ch of text) {
    if (ch === '(') { depth++; masked += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); masked += ch; }
    else if (depth > 0 && ch === '.') { masked += P1; }
    else if (depth > 0 && ch === ';') { masked += P2; }
    else { masked += ch; }
  }
  return masked.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(s => s.split(P1).join('.').split(P2).join(';').trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* mirror of JSX formatSentenceFieldLines */
const formatSentenceLines = (text) => {
  const sentences = splitBySentence(text);
  const lines = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        lines.push(parsed.label + ':');
        parts.forEach(item => lines.push(`${n++}. ${item}`));
      } else {
        lines.push(parsed.label + ':');
        lines.push(`${n++}. ${parsed.value}`);
      }
    } else {
      lines.push(`${n++}. ${s}`);
    }
  });
  return lines;
};

const getNestedVal = (record, key) => {
  if (key.includes('.')) {
    const parts = key.split('.');
    let val = record;
    for (const p of parts) { val = val?.[p]; }
    return val;
  }
  return record[key];
};

/* ═══════ FIELD RENDER (flat elements, one glue View per field) ═══════ */
const fieldBody = (record, f, title) => {
  const val = getNestedVal(record, f.key);
  if (!hasVal(val)) return null;
  const label = f.label;
  const els = [];
  const pushLabel = () => { if (!sameAsTitle(label, title)) els.push(<Text key="l" style={styles.fieldLabel}>{safeString(label)}</Text>); };

  if (f.kind === 'date') {
    pushLabel();
    els.push(<Text key="v" style={styles.fieldValue}>{formatDate(val)}</Text>);
  } else if (f.kind === 'object') {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    pushLabel();
    entries.forEach(([k, v], ei) => {
      const subLabel = f.immun ? (IMMUNIZATION_LABELS[k] || humanizeKey(k)) : k;
      els.push(<Text key={`sl${ei}`} style={styles.subLabel}>{safeString(subLabel)}</Text>);
      if (Array.isArray(v)) {
        v.filter(hasVal).forEach((item, i) => els.push(<Text key={`sl${ei}i${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(fmtVal(item))}`}</Text>));
      } else {
        els.push(<Text key={`sl${ei}v`} style={styles.listItem}>{`1. ${safeString(fmtVal(v))}`}</Text>);
      }
    });
  } else if (f.kind === 'recommendations') {
    const recs = Array.isArray(val) ? val.filter(Boolean) : [];
    if (recs.length === 0) return null;
    pushLabel();
    recs.forEach((rec, i) => {
      const recText = typeof rec === 'object' && rec.recommendation
        ? `${rec.recommendation}${rec.date ? ` (${formatDate(rec.date)})` : ''}`
        : safeString(rec);
      els.push(<Text key={`r${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(recText)}`}</Text>);
    });
  } else {
    const strVal = safeString(fmtVal(val));
    const sentences = splitBySentence(strVal);
    pushLabel();
    if (sentences.length > 1 || parseLabel(strVal).isLabeled) {
      formatSentenceLines(strVal).forEach((line, i) => els.push(<Text key={`s${i}`} style={styles.listItem}>{line}</Text>));
    } else {
      els.push(<Text key="v" style={styles.fieldValue}>{strVal}</Text>);
    }
  }
  return els.length > 0 ? els : null;
};

/* anti-orphan by FLATTENING: every field's body elements flow individually (small Text nodes,
   never a page-tall wrap={false} View); only sectionTitle + the first element are glued. */
const renderSection = (record, cfg, sIdx) => {
  const allEls = [];
  cfg.fields.forEach((f) => {
    const body = fieldBody(record, f, cfg.title);
    if (!body) return;
    body.forEach((el, i) => { allEls.push(React.cloneElement(el, { key: `${f.key}-${i}` })); });
  });
  if (allEls.length === 0) return null;
  const [first, ...rest] = allEls;
  return (
    <View key={sIdx} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(cfg.title)}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const PreventiveCareDocumentPDFTemplate = ({ document }) => {
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.preventive_care) records = document[0].preventive_care;
    else if (document.length > 0 && document[0]?.records) records = document[0].records;
    else records = document;
  } else if (document?.preventive_care) records = Array.isArray(document.preventive_care) ? document.preventive_care : [document.preventive_care];
  else if (document?.records) records = document.records;
  else if (document) records = [document];

  const validRecords = Array.isArray(records) ? records.filter(r => r && typeof r === 'object') : [];

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Preventive Care</Text>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>No preventive care data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Preventive Care</Text>
        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordCard} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Preventive Care Record ${idx + 1}`}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => renderSection(record, cfg, sIdx))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PreventiveCareDocumentPDFTemplate;
