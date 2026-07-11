import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * NeuromuscularDisorderDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Nested objects (muscleWeakness{distribution, mrcScale{...}}) -> recursive objectRows: every leaf is a
 * subLabel (humanized key) above its value row (never side-by-side). Empty objects/strings/arrays skip.
 * Record date is the record's own `date` field - NEVER createdAt/updatedAt.
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
const SECTION_ORDER = ['clinical', 'muscle-weakness', 'atrophy', 'fasciculations', 'reflex', 'respiratory', 'bulbar', 'alsfrs', 'findings', 'assessment', 'plan', 'recommendations', 'results', 'notes'];

const SECTION_TITLES = {
  'clinical': 'Clinical Details',
  'muscle-weakness': 'Muscle Weakness',
  'atrophy': 'Muscle Atrophy',
  'fasciculations': 'Fasciculations',
  'reflex': 'Reflex Changes',
  'respiratory': 'Respiratory Function',
  'bulbar': 'Bulbar Function',
  'alsfrs': 'ALSFRS-R Score',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  diagnosis: 'Diagnosis',
  muscleWeakness: 'Muscle Weakness',
  muscleAtrophy: 'Muscle Atrophy',
  fasciculations: 'Fasciculations',
  reflexChanges: 'Reflex Changes',
  respiratoryFunction: 'Respiratory Function',
  bulbarFunction: 'Bulbar Function',
  alsfrScore: 'ALSFRS-R Score',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'clinical': ['date', 'provider', 'facility', 'status', 'diagnosis'],
  'muscle-weakness': ['muscleWeakness'],
  'atrophy': ['muscleAtrophy'],
  'fasciculations': ['fasciculations'],
  'reflex': ['reflexChanges'],
  'respiratory': ['respiratoryFunction'],
  'bulbar': ['bulbarFunction'],
  'alsfrs': ['alsfrScore'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'recommendations': ['recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const NUMBER_FIELDS = [];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['muscleAtrophy', 'fasciculations'];
const OBJECT_FIELDS = ['muscleWeakness', 'respiratoryFunction', 'results'];
const NESTED_KEY_LABELS = { mrcScale: 'MRC Scale', distribution: 'Distribution', fvc: 'FVC', mip: 'MIP', mep: 'MEP' };

/* HELPERS (mirror the JSX) - safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars) */
const safeString = (val) => {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, "");
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

const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

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

/* splitBySentence: canonical + `\d` guard so inline-numbered lists ("1. ...2. ...") do NOT split at the marker
   dot (the marker is stripped by the leading `^\d+\.` map instead). Split char class is [.;] + whitespace. */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))(?<!\d)[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* objectRows: recursive nested-object renderer - every leaf is a subLabel (humanized key) above its value */
const objectRows = (obj) => {
  const out = [];
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (isEmptyDeep(v)) return;
    const lbl = NESTED_KEY_LABELS[k] || humanizeKey(k);
    if (Array.isArray(v)) {
      out.push(<Text key={out.length} style={styles.subLabel}>{safeString(lbl)}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach(it => out.push(<Text key={out.length} style={styles.value}>{safeString(fmtScalar(it))}</Text>));
    } else if (v && typeof v === 'object') {
      out.push(<Text key={out.length} style={styles.subLabel}>{safeString(lbl)}</Text>);
      objectRows(v).forEach(el => out.push(React.cloneElement(el, { key: out.length })));
    } else {
      out.push(<Text key={out.length} style={styles.subLabel}>{safeString(lbl)}</Text>);
      out.push(<Text key={out.length} style={styles.value}>{safeString(fmtScalar(v))}</Text>);
    }
  });
  return out;
};

const arrayRows = (v) => (Array.isArray(v) ? v.filter(x => !isEmptyDeep(x)) : [])
  .map((it, i) => <Text key={i} style={styles.value}>{safeString(`${i + 1}. ${it}`)}</Text>);

const fieldPresent = (record, f) => {
  const v = record[f];
  if (OBJECT_FIELDS.includes(f)) return !isEmptyDeep(v);
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (OBJECT_FIELDS.includes(f)) return objectRows(v);
  if (ARRAY_FIELDS.includes(f)) return arrayRows(v);
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

const NeuromuscularDisorderDocumentPDFTemplate = ({ document: docProp, records: recProp, data }) => {
  const src = docProp || recProp || data;
  let records = [];
  if (Array.isArray(src)) {
    if (src.length === 1 && src[0]?.neuromuscular_disorder) records = Array.isArray(src[0].neuromuscular_disorder) ? src[0].neuromuscular_disorder : [src[0].neuromuscular_disorder];
    else records = src;
  } else if (src?.neuromuscular_disorder) records = Array.isArray(src.neuromuscular_disorder) ? src.neuromuscular_disorder : [src.neuromuscular_disorder];
  else if (src && typeof src === 'object') records = [src];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Neuromuscular Disorder</Text>
          <Text style={styles.noData}>No neuromuscular disorder records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Neuromuscular Disorder</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Neuromuscular Disorder Record ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default NeuromuscularDisorderDocumentPDFTemplate;
