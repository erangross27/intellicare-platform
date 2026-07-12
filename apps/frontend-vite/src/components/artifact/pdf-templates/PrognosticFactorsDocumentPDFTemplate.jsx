/**
 * PrognosticFactorsDocumentPDFTemplate.jsx
 * March 2026 — Box-free — Helvetica LETTER — black on white — underlined bare labels
 * Collection: prognostic_factors
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ═══════ BOX-FREE PDF STYLES ═══════ */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', marginBottom: 14 },
  recordCard: { marginBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', marginTop: 6, marginBottom: 10 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', marginTop: 8, marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', marginTop: 6, marginBottom: 2 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 14, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 2 },
});

/* ═══════ CONFIG (mirrors PrognosticFactorsDocument.jsx) ═══════ */
const SECTION_TITLES = {
  'general-info': 'General Information',
  'favorable-factors': 'Favorable Factors',
  'adverse-factors': 'Adverse Factors',
  'survival-estimates': 'Survival Estimates',
  'recurrence-risk': 'Recurrence Risk',
  'prognostic-scores': 'Prognostic Scores',
  'molecular-subtype': 'Molecular Subtype',
  'results': 'Results',
  'clinical-findings': 'Clinical Findings',
  'plan-recommendations': 'Plan and Notes',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  favorableFactors: 'Favorable Factors',
  adverseFactors: 'Adverse Factors',
  survivalEstimates: 'Survival Estimates',
  recurrenceRisk: 'Recurrence Risk',
  prognosticScores: 'Prognostic Scores',
  molecularSubtype: 'Molecular Subtype',
  molecularSubtypeMethodology: 'Methodology',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'general-info': ['date', 'type', 'provider', 'facility', 'status'],
  'favorable-factors': ['favorableFactors'],
  'adverse-factors': ['adverseFactors'],
  'survival-estimates': ['survivalEstimates'],
  'recurrence-risk': ['recurrenceRisk'],
  'prognostic-scores': ['prognosticScores'],
  'molecular-subtype': ['molecularSubtype', 'molecularSubtypeMethodology'],
  'results': ['results'],
  'clinical-findings': ['findings', 'assessment'],
  'plan-recommendations': ['plan', 'notes'],
  'recommendations': ['recommendations'],
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['favorableFactors', 'adverseFactors', 'prognosticScores', 'recommendations'];
const OBJECT_FIELDS = ['survivalEstimates', 'results'];

/* ═══════ HELPERS ═══════ */
const safeString = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
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

const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const KEY_OVERRIDES = { fiveYear: 'Five-Year Survival', tenYear: 'Ten-Year Survival', oneYear: 'One-Year Survival', twoYear: 'Two-Year Survival', medianSurvival: 'Median Survival', progressionFreeSurvival: 'Progression-Free Survival' };
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

const formatRecDate = (dateValue) => {
  if (!dateValue) return '';
  const s = String(dateValue.$date || dateValue);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    try { const d = new Date(s); if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { /* fall through */ }
  }
  return s;
};

const flattenItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && !Array.isArray(item)) {
    if (item.recommendation) { const d = item.date ? ` (${formatRecDate(item.date)})` : ''; return `${item.recommendation}${d}`; }
    const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return '';
    return entries.map(([k, v]) => `${humanizeKey(k)}: ${v}`).join(', ');
  }
  return String(item);
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

/* formatSentenceLines: mirrors JSX formatSentenceFieldLines */
const formatSentenceLines = (text) => {
  const sentences = splitBySentence(text);
  const out = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        out.push({ sub: parsed.label });
        parts.forEach(item => out.push({ item: `${n++}. ${item}` }));
      } else { out.push({ sub: parsed.label }); out.push({ item: `${n++}. ${parsed.value}` }); }
    } else { out.push({ item: `${n++}. ${s}` }); }
  });
  return out;
};

const fieldHasVal = (fn, val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return Number.isFinite(val);
  if (typeof val === 'string') return val.trim() !== '';
  if (Array.isArray(val)) return val.filter(x => !isEmptyDeep(x)).length > 0;
  if (typeof val === 'object') return Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).length > 0;
  return true;
};

/* fieldBody: FLAT array of Text elements for one field (bare label + body rows) */
const fieldBody = (fn, val, sid) => {
  const label = FIELD_LABELS[fn] || fn;
  const els = [];
  if (!sameAsTitle(label, sid)) els.push(<Text style={styles.fieldLabel}>{safeString(label)}</Text>);

  if (DATE_FIELDS.includes(fn)) {
    els.push(<Text style={styles.value}>{safeString(formatDate(val))}</Text>);
  } else if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x)).map(flattenItem).filter(s => s && s.trim());
    items.forEach((item, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>));
  } else if (OBJECT_FIELDS.includes(fn)) {
    Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
      els.push(<Text style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(fmtScalar(v))}`}</Text>);
    });
  } else {
    const strVal = fmtScalar(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1 || parseLabel(strVal).isLabeled) {
      formatSentenceLines(strVal).forEach(line => {
        if (line.sub !== undefined) els.push(<Text style={styles.subLabel}>{safeString(line.sub)}</Text>);
        else els.push(<Text style={styles.listItem}>{safeString(line.item)}</Text>);
      });
    } else {
      els.push(<Text style={styles.value}>{safeString(strVal)}</Text>);
    }
  }
  return els;
};

/* renderSection: FLATTEN — glue sectionTitle + first body element in a wrap={false} View, rest flow */
const renderSection = (record, sid, ridx) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const bodyEls = [];
  fields.forEach(fn => { const val = record[fn]; if (fieldHasVal(fn, val)) fieldBody(fn, val, sid).forEach(el => bodyEls.push(el)); });
  if (bodyEls.length === 0) return null;

  const first = bodyEls[0];
  const rest = bodyEls.slice(1);
  return (
    <View key={`${sid}-${ridx}`} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {React.cloneElement(first, { key: 'f0' })}
      </View>
      {rest.map((el, i) => React.cloneElement(el, { key: `f${i + 1}` }))}
    </View>
  );
};

/* ═══════ DATA UNWRAP ═══════ */
const unwrapData = (rawData) => {
  if (!rawData) return [];
  let arr = Array.isArray(rawData) ? rawData : [rawData];
  arr = arr.flatMap(r => {
    if (r?.prognostic_factors) return Array.isArray(r.prognostic_factors) ? r.prognostic_factors : [r.prognostic_factors];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.prognostic_factors) return Array.isArray(dd.prognostic_factors) ? dd.prognostic_factors : [dd.prognostic_factors]; return [dd]; }
    if (r?._records && Array.isArray(r._records)) return r._records;
    if (r?.records && Array.isArray(r.records)) return r.records;
    return [r];
  });
  return arr.filter(r => r && typeof r === 'object');
};

const PrognosticFactorsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Prognostic Factors</Text>
          <Text style={styles.value}>No prognostic factors records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Prognostic Factors</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard} break={idx > 0}>
            <Text style={styles.recordTitle}>Prognostic Factor {idx + 1}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid, idx))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrognosticFactorsDocumentPDFTemplate;
