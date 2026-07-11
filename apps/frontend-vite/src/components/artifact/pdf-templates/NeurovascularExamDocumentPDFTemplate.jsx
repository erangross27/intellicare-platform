import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * NeurovascularExamDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Nested/dotted fields resolved via resolvePath:
 *   sensoryExam.distributions (string[]), sensoryExam.intact (boolean),
 *   motorExam.movements (array of {muscle, strength} -> subLabel muscle + strength value row),
 *   pulses.dorsalisPedis / pulses.posteriorTibial (dotted scalars),
 *   results (dynamic-key object -> recursive flatten).
 * Record date is record.date - NEVER createdAt/updatedAt.
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
const SECTION_ORDER = ['exam-info', 'sensory-exam', 'motor-exam', 'vascular-assessment', 'findings', 'assessment-plan', 'notes-recommendations'];

const SECTION_TITLES = {
  'exam-info': 'Exam Information',
  'sensory-exam': 'Sensory Examination',
  'motor-exam': 'Motor Examination',
  'vascular-assessment': 'Vascular Assessment',
  'findings': 'Findings',
  'assessment-plan': 'Assessment & Plan',
  'notes-recommendations': 'Notes & Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  type: 'Type',
  'sensoryExam.distributions': 'Distributions',
  'sensoryExam.intact': 'Intact',
  'motorExam.movements': 'Movements',
  'pulses.dorsalisPedis': 'Dorsalis Pedis',
  'pulses.posteriorTibial': 'Posterior Tibial',
  capillaryRefill: 'Capillary Refill',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  recommendations: 'Recommendations',
  results: 'Results',
};

const SECTION_FIELDS = {
  'exam-info': ['date', 'provider', 'facility', 'status', 'type'],
  'sensory-exam': ['sensoryExam.distributions', 'sensoryExam.intact'],
  'motor-exam': ['motorExam.movements'],
  'vascular-assessment': ['pulses.dorsalisPedis', 'pulses.posteriorTibial', 'capillaryRefill'],
  'findings': ['findings'],
  'assessment-plan': ['assessment', 'plan'],
  'notes-recommendations': ['notes', 'recommendations', 'results'],
};

const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['sensoryExam.intact'];
const ARRAY_FIELDS = ['sensoryExam.distributions', 'recommendations'];
const OBJECT_ARRAY_FIELDS = ['motorExam.movements'];
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

/* resolvePath: read a dotted field path (e.g. "pulses.dorsalisPedis") off the record */
const resolvePath = (record, path) => {
  if (!record || !path) return undefined;
  return String(path).split('.').reduce((v, k) => (v === null || v === undefined ? undefined : v[k]), record);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const humanizeKey = (k) => String(k)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, c => c.toUpperCase())
  .trim();

/* Recursively flatten a dynamic-key object into [{label, value}] leaf rows (hide-empty at every level) */
const flattenDynamic = (obj, prefix) => {
  const rows = [];
  if (!obj || typeof obj !== 'object') return rows;
  Object.entries(obj).forEach(([k, v]) => {
    if (!hasVal(v)) return;
    const label = prefix ? `${prefix} > ${humanizeKey(k)}` : humanizeKey(k);
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') rows.push(...flattenDynamic(item, `${label} ${i + 1}`));
        else if (hasVal(item)) rows.push({ label: `${label} ${i + 1}`, value: safeString(item) });
      });
    } else if (v && typeof v === 'object') {
      rows.push(...flattenDynamic(v, label));
    } else {
      rows.push({ label, value: typeof v === 'boolean' ? (v ? 'Yes' : 'No') : safeString(v) });
    }
  });
  return rows;
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

/* motorExam.movements: array of {muscle, strength} -> each object becomes a subLabel (muscle) + strength value */
const movementRows = (val) => {
  const items = (Array.isArray(val) ? val : []).filter(m => m && (String(m.muscle || '').trim() || String(m.strength || '').trim()));
  return items.map((m, i) => {
    const muscle = safeString(String(m.muscle || '').trim());
    const strength = safeString(String(m.strength || '').trim());
    return (
      <View key={i}>
        {muscle ? <Text style={styles.subLabel}>{muscle}</Text> : null}
        {strength ? <Text style={styles.value}>{strength}</Text> : null}
      </View>
    );
  });
};

/* string arrays (distributions) / object arrays (recommendations) -> one value row per item */
const arrayRows = (val) => {
  const items = (Array.isArray(val) ? val : []).filter(x => hasVal(x));
  return items.map((it, i) => {
    if (it && typeof it === 'object') {
      const t = it.recommendation || it.text || flattenDynamic(it, '').map(r => r.value).join(', ');
      return <Text key={i} style={styles.value}>{safeString(String(t))}</Text>;
    }
    return <Text key={i} style={styles.value}>{safeString(String(it))}</Text>;
  });
};

const fieldPresent = (record, f) => {
  const v = resolvePath(record, f);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(m => m && (String(m.muscle || '').trim() || String(m.strength || '').trim())).length > 0;
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(x => hasVal(x)).length > 0;
  if (DYNAMIC_OBJECT_FIELDS.includes(f)) return flattenDynamic(v, '').length > 0;
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = resolvePath(record, f);
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return movementRows(v);
  if (ARRAY_FIELDS.includes(f)) return arrayRows(v);
  if (DYNAMIC_OBJECT_FIELDS.includes(f)) {
    const rows = flattenDynamic(v, '');
    return rows.flatMap((r, i) => [
      <Text key={`l${i}`} style={styles.subLabel}>{safeString(r.label)}</Text>,
      <Text key={`x${i}`} style={styles.value}>{safeString(r.value)}</Text>,
    ]);
  }
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

const NeurovascularExamDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.neurovascular_exam) records = Array.isArray(data[0].neurovascular_exam) ? data[0].neurovascular_exam : [data[0].neurovascular_exam];
    else records = data;
  } else if (data?.neurovascular_exam) records = Array.isArray(data.neurovascular_exam) ? data.neurovascular_exam : [data.neurovascular_exam];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Neurovascular Exam</Text>
          <Text style={styles.noData}>No neurovascular exam records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Neurovascular Exam</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Neurovascular Exam ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default NeurovascularExamDocumentPDFTemplate;
