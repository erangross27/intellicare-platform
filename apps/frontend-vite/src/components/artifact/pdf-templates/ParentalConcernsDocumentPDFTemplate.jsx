import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ParentalConcernsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * concerns = array of {topic, description, addressed} -> each object decomposes into a subLabel
 * (topic) + a value line per remaining leaf (mirrors the JSX; never side-by-side).
 * results = OBJECT -> recursive objectRows. recommendations = array (strings or {recommendation, date}).
 * Record date is the record.date field - NEVER createdAt/updatedAt.
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
const SECTION_ORDER = ['record-info', 'concerns', 'family-home', 'findings', 'assessment-plan', 'results', 'recommendations', 'notes'];

const SECTION_TITLES = {
  'record-info': 'Record Information',
  'concerns': 'Concerns',
  'family-home': 'Family & Home',
  'findings': 'Findings',
  'assessment-plan': 'Assessment & Plan',
  'results': 'Results',
  'recommendations': 'Recommendations',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  provider: 'Provider',
  facility: 'Facility',
  date: 'Date',
  status: 'Status',
  concerns: 'Concerns',
  familySupport: 'Family Support',
  homeEnvironment: 'Home Environment',
  parentingStress: 'Parenting Stress',
  siblingRelationships: 'Sibling Relationships',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['provider', 'facility', 'date', 'status'],
  'concerns': ['concerns'],
  'family-home': ['familySupport', 'homeEnvironment', 'parentingStress', 'siblingRelationships'],
  'findings': ['findings'],
  'assessment-plan': ['assessment', 'plan'],
  'results': ['results'],
  'recommendations': ['recommendations'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = [];
const CONCERNS_FIELDS = ['concerns'];
const ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['results'];

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

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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

/* recursive object node (results): label = bold heading; value = plain line below */
const objectRows = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
        <Text style={styles.value}>{safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
      {entries.map(([k, v]) => objectRows(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}
    </View>
  );
};

/* concerns array-of-objects: each object -> subLabel (topic) + one value line per remaining leaf */
const concernRows = (val) => {
  const items = (Array.isArray(val) ? val : []).filter(c => c && typeof c === 'object' && Object.values(c).some(x => hasVal(x)));
  return items.map((c, i) => {
    const topic = safeString((c.topic || `Concern ${i + 1}`).toString().trim());
    const leaves = Object.entries(c).filter(([k, v]) => k !== 'topic' && hasVal(v));
    return (
      <View key={i} wrap={false}>
        <Text style={styles.subLabel}>{topic}</Text>
        {leaves.map(([k, v]) => (
          <Text key={k} style={styles.value}>{safeString(String(v).trim())}</Text>
        ))}
      </View>
    );
  });
};

/* recommendations: array of strings OR {recommendation, date} objects */
const recommendationRows = (val) => {
  const items = (Array.isArray(val) ? val : []).filter(r => hasVal(r));
  return items.map((rec, i) => {
    if (rec && typeof rec === 'object') {
      const recText = safeString((rec.recommendation || '').trim());
      const recDate = (rec.date || '').trim();
      return (
        <View key={i}>
          {recText ? <Text style={styles.subLabel}>{recText}</Text> : null}
          {recDate ? <Text style={styles.value}>{safeString(formatDate(recDate))}</Text> : null}
        </View>
      );
    }
    return <Text key={i} style={styles.value}>{safeString(String(rec).trim())}</Text>;
  });
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (CONCERNS_FIELDS.includes(f)) return Array.isArray(v) && v.filter(c => c && typeof c === 'object' && Object.values(c).some(x => hasVal(x))).length > 0;
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(x => hasVal(x)).length > 0;
  if (OBJECT_FIELDS.includes(f)) return v && typeof v === 'object' && !Array.isArray(v) && !isEmptyDeep(v);
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (CONCERNS_FIELDS.includes(f)) return concernRows(v);
  if (ARRAY_FIELDS.includes(f)) return recommendationRows(v);
  if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(v).filter(([, x]) => !isEmptyDeep(x));
    return entries.map(([k, x]) => objectRows(humanizeKey(k), x, `${f}-${k}`, 1));
  }
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
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

const ParentalConcernsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.parental_concerns) records = Array.isArray(data[0].parental_concerns) ? data[0].parental_concerns : [data[0].parental_concerns];
    else records = data;
  } else if (data?.parental_concerns) records = Array.isArray(data.parental_concerns) ? data.parental_concerns : [data.parental_concerns];
  else if (data?.documentData?.parental_concerns) records = Array.isArray(data.documentData.parental_concerns) ? data.documentData.parental_concerns : [data.documentData.parental_concerns];
  else if (data?.documentData) records = Array.isArray(data.documentData) ? data.documentData : [data.documentData];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Parental Concerns</Text>
          <Text style={styles.noData}>No parental concerns records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Parental Concerns</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Parental Concerns ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default ParentalConcernsDocumentPDFTemplate;
