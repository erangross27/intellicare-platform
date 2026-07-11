import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PalliativeCareNeedsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Record date is record.date - NEVER createdAt/updatedAt (ingestion timestamps).
 * booleans -> Yes/No; symptomsAddressed/psychosocialSupport arrays -> one value row per item;
 * painAssessment (object) / results (dynamic object) / recommendations decompose recursively.
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
const SECTION_ORDER = ['general-info', 'symptoms-addressed', 'pain-assessment', 'psychosocial-support', 'care-options', 'quality-of-life', 'findings', 'assessment', 'plan', 'recommendations', 'results', 'notes'];

const SECTION_TITLES = {
  'general-info': 'General Information',
  'symptoms-addressed': 'Symptoms Addressed',
  'pain-assessment': 'Pain Assessment',
  'psychosocial-support': 'Psychosocial Support',
  'care-options': 'Care Options',
  'quality-of-life': 'Quality of Life',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  symptomsAddressed: 'Symptoms Addressed',
  painAssessment: 'Pain Assessment',
  psychosocialSupport: 'Psychosocial Support',
  spiritualCare: 'Spiritual Care',
  hospiceDiscussion: 'Hospice Discussion',
  qualityOfLifeScore: 'Quality of Life Score',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'general-info': ['date', 'type', 'provider', 'facility', 'status'],
  'symptoms-addressed': ['symptomsAddressed'],
  'pain-assessment': ['painAssessment'],
  'psychosocial-support': ['psychosocialSupport'],
  'care-options': ['spiritualCare', 'hospiceDiscussion'],
  'quality-of-life': ['qualityOfLifeScore'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'recommendations': ['recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['spiritualCare', 'hospiceDiscussion'];
const ARRAY_FIELDS = ['symptomsAddressed', 'psychosocialSupport'];
const OBJECT_FIELDS = ['painAssessment'];
const RECOMMENDATIONS_FIELDS = ['recommendations'];
const DYNAMIC_OBJECT_FIELDS = ['results'];
const NUMBER_FIELDS = [];

/* HELPERS (mirror the JSX) - safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars) */
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const isEmptyDeep = (v) => {
  if (v === null || v === undefined || v === '') return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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

/* objectLines: recursively flatten a dynamic-key object into indented label/value lines */
const objectLines = (value, depth = 0, label = '') => {
  const out = [];
  if (isEmptyDeep(value)) return out;
  if (value === null || typeof value !== 'object') {
    out.push({ depth, label, value: fmtVal(value) });
    return out;
  }
  if (Array.isArray(value)) {
    if (label) out.push({ depth, label, value: null });
    value.filter(v => !isEmptyDeep(v)).forEach((v) => { out.push(...objectLines(v, depth + (label ? 1 : 0), '')); });
    return out;
  }
  if (label) out.push({ depth, label, value: null });
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    out.push(...objectLines(v, depth + (label ? 1 : 0), humanizeKey(k)));
  });
  return out;
};

/* painAssessment key/value object -> stacked subLabel + value rows */
const objectRows = (obj) => {
  const entries = Object.entries(obj || {}).filter(([, v]) => hasVal(v));
  const rows = [];
  entries.forEach(([k, v]) => {
    rows.push(<Text key={`s-${k}`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
    rows.push(<Text key={`v-${k}`} style={styles.value}>{safeString(fmtVal(v))}</Text>);
  });
  return rows;
};

/* results dynamic-key object -> recursively flattened stacked rows (never side-by-side) */
const dynamicRows = (obj) => {
  return objectLines(obj, 0, '').map((ln, i) => {
    if (ln.value === null) return <Text key={i} style={styles.subLabel}>{safeString(ln.label)}</Text>;
    if (ln.label) return (
      <View key={i}>
        <Text style={styles.subLabel}>{safeString(ln.label)}</Text>
        <Text style={styles.value}>{safeString(ln.value)}</Text>
      </View>
    );
    return <Text key={i} style={styles.value}>{safeString(ln.value)}</Text>;
  });
};

/* recommendations: array of strings OR {recommendation, date} objects -> subLabel + date value */
const recommendationRows = (val) => {
  const items = (Array.isArray(val) ? val : []).filter(it => !isEmptyDeep(it));
  return items.map((it, i) => {
    if (typeof it === 'string') return <Text key={i} style={styles.value}>{safeString(it)}</Text>;
    if (it && typeof it === 'object' && !Array.isArray(it)) {
      const rec = safeString(String(it.recommendation || it.text || '').trim());
      const dt = it.date ? formatDate(it.date) : '';
      if (!rec) return <View key={i}>{objectLines(it, 0, '').map((ln, j) => (ln.value === null ? <Text key={j} style={styles.subLabel}>{safeString(ln.label)}</Text> : <Text key={j} style={styles.value}>{safeString(ln.label ? `${ln.label}: ${ln.value}` : ln.value)}</Text>))}</View>;
      return (
        <View key={i}>
          <Text style={styles.subLabel}>{rec}</Text>
          {dt ? <Text style={styles.value}>{safeString(dt)}</Text> : null}
        </View>
      );
    }
    return <Text key={i} style={styles.value}>{safeString(it)}</Text>;
  });
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (OBJECT_FIELDS.includes(f) || RECOMMENDATIONS_FIELDS.includes(f) || DYNAMIC_OBJECT_FIELDS.includes(f)) return !isEmptyDeep(v);
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v === true || v === 'true' || v === 'Yes' ? 'Yes' : 'No'}</Text>];
  if (ARRAY_FIELDS.includes(f)) return (Array.isArray(v) ? v : [v]).filter(Boolean).map((it, i) => <Text key={i} style={styles.value}>{safeString(it)}</Text>);
  if (OBJECT_FIELDS.includes(f)) return objectRows(v);
  if (RECOMMENDATIONS_FIELDS.includes(f)) return recommendationRows(v);
  if (DYNAMIC_OBJECT_FIELDS.includes(f)) return dynamicRows(v);
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
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

const PalliativeCareNeedsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.palliative_care_needs) records = Array.isArray(data[0].palliative_care_needs) ? data[0].palliative_care_needs : [data[0].palliative_care_needs];
    else records = data;
  } else if (data?.palliative_care_needs) records = Array.isArray(data.palliative_care_needs) ? data.palliative_care_needs : [data.palliative_care_needs];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Palliative Care Needs</Text>
          <Text style={styles.noData}>No palliative care needs records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Palliative Care Needs</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Palliative Care Needs ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PalliativeCareNeedsDocumentPDFTemplate;
