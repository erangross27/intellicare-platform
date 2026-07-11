import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * LupusAssessmentDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity. No boxes:
 * underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Nested objects resolved by dotted path (resolvePath); deep objects/arrays render via objectRows.
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
const SECTION_ORDER = ['session-info', 'sledai-acr', 'eular-criteria', 'cutaneous', 'renal', 'neuro-heme-serositis', 'findings-section', 'assessment-plan', 'results-section', 'recommendations-section', 'notes-section'];

const SECTION_TITLES = {
  'session-info': 'Session Information',
  'sledai-acr': 'SLEDAI Score & ACR 1997 Criteria',
  'eular-criteria': 'EULAR Criteria',
  'cutaneous': 'Cutaneous Manifestations',
  'renal': 'Renal Involvement',
  'neuro-heme-serositis': 'Neurological, Hematological & Serositis',
  'findings-section': 'Findings',
  'assessment-plan': 'Assessment & Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-section': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  sledaiScore: 'SLEDAI Score',
  acr1997Criteria: 'ACR 1997 Criteria',
  eularCriteria: 'EULAR Criteria',
  'cutaneousManifestations.malarRash': 'Malar Rash',
  'cutaneousManifestations.discoidRash': 'Discoid Rash',
  'cutaneousManifestations.photosensitivity': 'Photosensitivity',
  'cutaneousManifestations.oralUlcers': 'Oral Ulcers',
  'cutaneousManifestations.alopecia': 'Alopecia',
  'renalInvolvement.proteinuria': 'Proteinuria',
  'renalInvolvement.hematuria': 'Hematuria',
  'renalInvolvement.casts': 'Casts',
  'renalInvolvement.twentyFourHourUrineOrdered': '24-Hour Urine Ordered',
  neurologicalInvolvement: 'Neurological Involvement',
  'hematologicalInvolvement.anemia': 'Anemia',
  'hematologicalInvolvement.leukopenia': 'Leukopenia',
  'hematologicalInvolvement.thrombocytopenia': 'Thrombocytopenia',
  'hematologicalInvolvement.lymphopenia': 'Lymphopenia',
  serositis: 'Serositis',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'sledai-acr': ['sledaiScore', 'acr1997Criteria'],
  'eular-criteria': ['eularCriteria'],
  'cutaneous': ['cutaneousManifestations.malarRash', 'cutaneousManifestations.discoidRash', 'cutaneousManifestations.photosensitivity', 'cutaneousManifestations.oralUlcers', 'cutaneousManifestations.alopecia'],
  'renal': ['renalInvolvement.proteinuria', 'renalInvolvement.hematuria', 'renalInvolvement.casts', 'renalInvolvement.twentyFourHourUrineOrdered'],
  'neuro-heme-serositis': ['neurologicalInvolvement', 'hematologicalInvolvement.anemia', 'hematologicalInvolvement.leukopenia', 'hematologicalInvolvement.thrombocytopenia', 'hematologicalInvolvement.lymphopenia', 'serositis'],
  'findings-section': ['findings'],
  'assessment-plan': ['assessment', 'plan'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-section': ['notes'],
};

const ARRAY_FIELDS = ['acr1997Criteria', 'eularCriteria', 'neurologicalInvolvement', 'serositis'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['results'];
const RECOMMENDATION_FIELDS = ['recommendations'];
const BOOLEAN_FIELDS = ['cutaneousManifestations.malarRash', 'cutaneousManifestations.discoidRash', 'cutaneousManifestations.photosensitivity', 'cutaneousManifestations.oralUlcers', 'renalInvolvement.hematuria', 'renalInvolvement.twentyFourHourUrineOrdered'];
const DATE_FIELDS = ['date'];

/* HELPERS (mirror the JSX) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200D\u2028\u2029\uFEFF]/g, '');
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
  if (Array.isArray(v)) return v.filter((x) => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const resolvePath = (obj, pathStr) => {
  if (!obj || typeof obj !== 'object') return undefined;
  if (!pathStr.includes('.')) return obj[pathStr];
  return pathStr.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map((s) => s.trim().replace(/^\d+\.\s+/, '')).filter((s) => s && !/^[;.,!?]+$/.test(s));
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma, decomposing nested "Label: value"
   comma items into their own sub-label (mirrors the JSX; never side-by-side). */
const sentenceRows = (text) => {
  const rows = [];
  splitBySentence(text).forEach((sentence) => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) {
        rows.push({ type: 'sub', text: p.label });
        items.forEach((it) => {
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

/* objectRows: recursive box-free rendering of a nested object (results). */
const objectRows = (obj, depth) => {
  if (!obj || typeof obj !== 'object') return [];
  const rows = [];
  Object.entries(obj).forEach(([k, v], i) => {
    if (k === '_id' || isEmptyDeep(v)) return;
    if (Array.isArray(v)) {
      rows.push(<Text key={`s${depth}-${i}`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      v.filter((x) => hasVal(x)).forEach((it, j) => rows.push(<Text key={`a${depth}-${i}-${j}`} style={styles.value}>{`${j + 1}. ${strip(String(it))}`}</Text>));
    } else if (v && typeof v === 'object') {
      rows.push(<Text key={`s${depth}-${i}`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      objectRows(v, depth + 1).forEach((r) => rows.push(r));
    } else {
      rows.push(<Text key={`s${depth}-${i}`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      rows.push(<Text key={`v${depth}-${i}`} style={styles.value}>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : strip(String(v))}</Text>);
    }
  });
  return rows;
};

/* recommendationRows: array of {recommendation, date}, date-grouped. */
const recommendationRows = (items) => {
  const recs = (Array.isArray(items) ? items : []).filter((r) => (r && typeof r === 'object') ? String(r.recommendation || '').trim() : String(r).trim());
  const rows = []; let lastDate = null;
  recs.forEach((rec, i) => {
    const isObj = rec && typeof rec === 'object';
    const d = isObj ? String(rec.date || '').trim() : '';
    const t = isObj ? String(rec.recommendation || '').trim() : String(rec).trim();
    if (d && d !== lastDate) { rows.push(<Text key={`d${i}`} style={styles.subLabel}>{safeString(d)}</Text>); lastDate = d; }
    rows.push(<Text key={`t${i}`} style={styles.value}>{`${i + 1}. ${strip(t)}`}</Text>);
  });
  return rows;
};

const textRows = (v) => {
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const fieldBody = (record, f) => {
  const v = resolvePath(record, f);
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).filter((x) => hasVal(x));
    return items.map((it, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${strip(String(it))}`}</Text>);
  }
  if (RECOMMENDATION_FIELDS.includes(f)) return recommendationRows(v);
  if (OBJECT_FIELDS.includes(f)) return objectRows(v, 0);
  return textRows(v);
};

const renderSection = (record, sid) => {
  const fields = (SECTION_FIELDS[sid] || []).filter((f) => hasVal(resolvePath(record, f)));
  if (fields.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return fields.map((f, i) => {
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

const LupusAssessmentDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0] && data[0].lupus_assessment) {
      records = Array.isArray(data[0].lupus_assessment) ? data[0].lupus_assessment : [data[0].lupus_assessment];
    } else records = data;
  } else if (data && typeof data === 'object') {
    if (data.lupus_assessment) records = Array.isArray(data.lupus_assessment) ? data.lupus_assessment : [data.lupus_assessment];
    else records = [data];
  }
  records = records.filter((r) => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Lupus Assessment</Text>
          <Text style={styles.noData}>No lupus assessment records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Lupus Assessment</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Lupus Assessment ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map((sid) => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default LupusAssessmentDocumentPDFTemplate;
