/**
 * ContractionMonitoringDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1: wrap = BOOLEANS; recordContainer paddingBottom only + break={idx>0} (Rule #75);
 * sectionTitle rides INSIDE the section's wrap-gated View (anti-orphan).
 * 4-area mirror of the JSX/copy: canonical splitBySentence ([;.] + abbrev guard) + guarded splitByComma;
 * paren-aware parseLabel (labels like "Early labor phase (04:30-07:00)" keep their time-range parens);
 * labeled sentence >=3 comma parts → sub-label + numbered rows (count restarts); labeled <3 → sub-label + "1. content";
 * unlabeled >=3 → numbered part rows (count continues); objects (braxtonHicks/results) → per-leaf sub-label + "1. value";
 * recommendations grouped by CONSECUTIVE same date (mirrors the JSX grouping).
 * Collection: contraction_monitoring
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginTop: 6, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginTop: 4, marginBottom: 3 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, paddingLeft: 8, lineHeight: 1.4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'monitoring-info': 'Monitoring Information',
  'braxton-hicks': 'Braxton Hicks',
  'true-labor': 'True Labor Assessment',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'results': 'Results',
  'plan-notes': 'Plan & Notes',
  'tocolytics': 'Tocolytics',
};
const FIELD_LABELS = {
  provider: 'Provider',
  facility: 'Facility',
  date: 'Date',
  type: 'Type',
  status: 'Status',
  braxtonHicks: 'Braxton Hicks',
  'trueLabor.contractionFrequency': 'Contraction Frequency',
  'trueLabor.duration': 'Duration',
  'trueLabor.intensity': 'Intensity',
  'trueLabor.cervicalChange': 'Cervical Change',
  findings: 'Findings',
  assessment: 'Assessment',
  results: 'Results',
  plan: 'Plan',
  notes: 'Notes',
  pretermLaborRisk: 'Preterm Labor Risk',
  recommendations: 'Recommendations',
  tocolytics: 'Tocolytics',
};
const SECTION_FIELDS = {
  'provider-info': ['provider', 'facility'],
  'monitoring-info': ['date', 'type', 'status'],
  'braxton-hicks': ['braxtonHicks'],
  'true-labor': ['trueLabor.contractionFrequency', 'trueLabor.duration', 'trueLabor.intensity', 'trueLabor.cervicalChange'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'results': ['results'],
  'plan-notes': ['plan', 'notes', 'pretermLaborRisk', 'recommendations'],
  'tocolytics': ['tocolytics'],
};
const SECTION_ORDER = ['provider-info', 'monitoring-info', 'braxton-hicks', 'true-labor', 'findings', 'assessment', 'results', 'plan-notes', 'tocolytics'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes', 'pretermLaborRisk'];
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['trueLabor.cervicalChange'];
const ARRAY_FIELDS = ['tocolytics'];
const OBJECT_FIELDS = ['braxtonHicks', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
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
const hasVal = (v) => !isEmptyDeep(v);
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const getVal = (record, fn) => {
  if (fn.includes('.')) { let val = record; for (const p of fn.split('.')) { if (val == null) return undefined; val = val[p]; } return val; }
  return record[fn];
};
// Canonical: splits on '.' AND ';' with the abbreviation+decimal guard ("1.5-2 min" never breaks).
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
// Paren-aware label detection: first ": " at paren depth 0 splits ("Early labor phase (04:30-07:00): ..." keeps its time colons).
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ':' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) return null;
      const label = text.slice(0, i).trim();
      const content = text.slice(i + 1).trim();
      if (/^[A-Za-z]/.test(label) && label.length >= 3 && label.length <= 60 && content) return { label, content };
      return null;
    }
  }
  return null;
};
// paren-aware; keep Oxford ", and/or X"; skip no-space commas ("$18,000") and date commas ("January 8, 2026").
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      const t = cur.trim(); if (t) parts.push(t); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.filter(Boolean);
};

/* Per-leaf object walk: each leaf → sub-label + "1. value" (mirrors the JSX renderObjectLeaf cards). */
const objectFieldLines = (value, out) => {
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    out.push({ k: 'sub', t: humanizeKey(k) });
    if (isScalar(v)) out.push({ k: 'row', t: `1. ${fmtScalar(v)}` });
    else if (Array.isArray(v)) { let n = 0; v.filter(x => !isEmptyDeep(x)).forEach(x => out.push({ k: 'row', t: `${++n}. ${isScalar(x) ? fmtScalar(x) : JSON.stringify(x)}` })); }
    else objectFieldLines(v, out);
  });
};

/* Build {k:'label'|'sub'|'row', t} lines for one field — the exact mirror of buildSectionCopyText. */
const fieldLines = (record, f, sectionTitle) => {
  const label = FIELD_LABELS[f] || f;
  const sameTitle = label.trim().toLowerCase() === (sectionTitle || '').trim().toLowerCase();
  const val = getVal(record, f);
  const lines = [];
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const arr = (Array.isArray(val) ? val : []).filter(Boolean);
    if (arr.length === 0) return lines;
    if (!sameTitle) lines.push({ k: 'label', t: label });
    // Group by CONSECUTIVE same date (mirrors the JSX renderRecommendationsField grouping).
    const groups = [];
    arr.forEach(rec => {
      const d = String(rec?.date || '').trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push(rec);
      else groups.push({ date: d, items: [rec] });
    });
    groups.forEach(g => {
      if (g.date) lines.push({ k: 'sub', t: g.date });
      let n = 0;
      g.items.forEach(rec => lines.push({ k: 'row', t: `${++n}. ${(rec?.recommendation || '').trim()}` }));
    });
  } else if (!hasVal(val)) {
    return lines;
  } else if (OBJECT_FIELDS.includes(f)) {
    if (!sameTitle) lines.push({ k: 'label', t: label });
    objectFieldLines(val, lines);
  } else if (BOOLEAN_FIELDS.includes(f)) {
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${val ? 'Yes' : 'No'}` });
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(Boolean);
    if (items.length === 0) return [];
    if (!sameTitle) lines.push({ k: 'label', t: label });
    items.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${String(item)}` }));
  } else if (SENTENCE_FIELDS.includes(f)) {
    if (!sameTitle) lines.push({ k: 'label', t: label });
    let n = 0;
    splitBySentence(fmtVal(val)).forEach(s => {
      const p = parseLabel(s);
      if (p) {
        const ci = splitByComma(p.content);
        lines.push({ k: 'sub', t: p.label }); n = 0;
        if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` }));
        else lines.push({ k: 'row', t: `${++n}. ${p.content}` });
      } else {
        const ci = splitByComma(s);
        if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` }));
        else lines.push({ k: 'row', t: `${++n}. ${s}` });
      }
    });
  } else if (DATE_FIELDS.includes(f)) {
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${formatDate(val)}` });
  } else {
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${fmtVal(val)}` });
  }
  return lines;
};

const ContractionMonitoringDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.contraction_monitoring) return Array.isArray(r.contraction_monitoring) ? r.contraction_monitoring : [r.contraction_monitoring];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.contraction_monitoring) return Array.isArray(dd.contraction_monitoring) ? dd.contraction_monitoring : [dd.contraction_monitoring]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Contraction Monitoring</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Contraction Monitoring</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Contraction Monitoring ${idx + 1}`}</Text>
            </View>
            {SECTION_ORDER.map(sid => {
              const lines = (SECTION_FIELDS[sid] || []).flatMap(f => fieldLines(record, f, SECTION_TITLES[sid]));
              if (lines.length === 0) return null;
              return (
                <View key={sid} style={styles.section} wrap={lines.length > 20 ? true : false}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {lines.map((ln, i) => ln.k === 'label'
                    ? <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>
                    : ln.k === 'sub'
                      ? <Text key={i} style={styles.subLabel}>{ln.t}</Text>
                      : <Text key={i} style={styles.listItem}>{ln.t}</Text>)}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ContractionMonitoringDocumentPDFTemplate;
