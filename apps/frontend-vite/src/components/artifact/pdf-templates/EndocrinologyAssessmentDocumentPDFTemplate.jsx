import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free B&W LETTER PDF (canonical one-pass): documentTitle 26 (borderBottom on style),
   recordTitle 19, sectionTitle 16 (+1pt #000), fieldLabel 13 (+0.5pt #999), values 14.
   Config-driven from SECTION_FIELDS — mirrors the JSX 4-area rendering (Copy === PDF). */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.5 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 16, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordCard: { marginBottom: 16 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBlock: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, color: '#000000', marginBottom: 3, lineHeight: 1.5 },
  noRecords: { fontSize: 14, color: '#555555', textAlign: 'center', marginTop: 40 },
});

/* ── Config mirrored from EndocrinologyAssessmentDocument.jsx ── */
const SECTION_ORDER = ['session-info', 'thyroid-function', 'parathyroid-function', 'adrenal-function', 'pituitary-function', 'metabolic-panel', 'findings-section', 'assessment-plan', 'recommendations-notes', 'results-section'];
const SECTION_TITLES = {
  'session-info': 'Session Information', 'thyroid-function': 'Thyroid Function', 'parathyroid-function': 'Parathyroid Function',
  'adrenal-function': 'Adrenal Function', 'pituitary-function': 'Pituitary Function', 'metabolic-panel': 'Metabolic Panel',
  'findings-section': 'Findings', 'assessment-plan': 'Assessment & Plan', 'recommendations-notes': 'Recommendations & Notes', 'results-section': 'Results',
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status',
  'thyroidFunction.tsh': 'TSH', 'thyroidFunction.freeT4': 'Free T4', 'thyroidFunction.freeT3': 'Free T3',
  'thyroidFunction.thyroidAntibodies.TSI': 'TSI', 'thyroidFunction.thyroidAntibodies.Anti-TPO': 'Anti-TPO',
  'parathyroidFunction.pth': 'PTH', 'parathyroidFunction.calcium': 'Calcium',
  metabolicPanel: 'Metabolic Panel', findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', notes: 'Notes', results: 'Results',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'type', 'provider', 'facility', 'status'],
  'thyroid-function': ['thyroidFunction.tsh', 'thyroidFunction.freeT4', 'thyroidFunction.freeT3', 'thyroidFunction.thyroidAntibodies.TSI', 'thyroidFunction.thyroidAntibodies.Anti-TPO'],
  'parathyroid-function': ['parathyroidFunction.pth', 'parathyroidFunction.calcium'],
  'adrenal-function': ['adrenalFunction'], 'pituitary-function': ['pituitaryFunction'], 'metabolic-panel': ['metabolicPanel'],
  'findings-section': ['findings'], 'assessment-plan': ['assessment', 'plan'], 'recommendations-notes': ['recommendations', 'notes'], 'results-section': ['results'],
};
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const DATE_FIELDS = ['date'];
const ENUM_FIELDS = ['status'];
const ENUM_OPTIONS = { status: ['Active', 'Completed', 'Not Active'] };
const OBJECT_FIELDS = ['metabolicPanel', 'results'];
const NESTED_OBJECT_FIELDS = ['adrenalFunction', 'pituitaryFunction'];

const KEY_OVERRIDES = { tsh: 'TSH', acth: 'ACTH', igf1: 'IGF-1', lh: 'LH', fsh: 'FSH', pth: 'PTH', ogtt: 'OGTT', vitaminD: 'Vitamin D', uricAcid: 'Uric Acid', freeT4: 'Free T4', freeT3: 'Free T3', fastingGlucose: 'Fasting Glucose' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ── Helpers ── */
const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try { const d = new Date(dateVal.$date || dateVal); if (isNaN(d.getTime())) return String(dateVal || ''); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateVal || ''); }
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const hasContent = (obj) => obj && typeof obj === 'object' && !isEmptyDeep(obj);
const getFieldValue = (record, f) => (!f.includes('.') ? record[f] : f.split('.').reduce((o, k) => (o == null ? undefined : o[k]), record));
const enumCanonical = (options, current) => { const cur = String(current ?? '').trim(); return options.find(o => o.toLowerCase() === cur.toLowerCase()) || cur; };

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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest) || /^\d/.test(text[i + 1] || '')) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    } else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s) && !/^\d+$/.test(s));
};

/* ── Row builders (mirror the JSX copy builders → Copy === PDF) ── */
function sentenceRows(text) {
  const rows = []; let n = 1;
  splitBySentence(text).forEach(s => {
    const p = parseLabel(s);
    if (p.isLabeled) {
      rows.push({ sub: p.label });
      const parts = splitByComma(p.value);
      if (parts.length >= 2) parts.forEach(it => rows.push({ value: `${n++}. ${it}` }));
      else rows.push({ value: `${n++}. ${p.value}` });
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 3) parts.forEach(it => rows.push({ value: `${n++}. ${it}` }));
      else rows.push({ value: `${n++}. ${s}` });
    }
  });
  return rows;
}
function objectRows(obj, rows) {
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    rows.push({ sub: humanizeKey(k) });
    if (isScalar(v)) rows.push({ value: fmtScalar(v) });
    else objectRows(v, rows);
  });
}
function nestedRawRows(obj, rows) {
  Object.entries(obj).forEach(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = Object.entries(v).filter(([, sv]) => hasVal(sv));
      if (!inner.length) return;
      rows.push({ sub: k });
      inner.forEach(([sk, sv]) => { rows.push({ sub: sk }); rows.push({ value: String(sv) }); });
    } else if (hasVal(v)) { rows.push({ sub: k }); rows.push({ value: String(v) }); }
  });
}
function recommendationRows(arr) {
  return arr.map((item, i) => (typeof item === 'object'
    ? { value: `${i + 1}. ${item.recommendation || ''}${item.date ? ` (${formatDate(item.date)})` : ''}` }
    : { value: `${i + 1}. ${String(item)}` }));
}

function fieldRows(record, f) {
  if (NESTED_OBJECT_FIELDS.includes(f)) { const v = record[f]; if (!hasContent(v)) return []; const rows = []; nestedRawRows(v, rows); return rows; }
  if (OBJECT_FIELDS.includes(f)) { const v = getFieldValue(record, f); if (!hasContent(v)) return []; const rows = []; objectRows(v, rows); return rows; }
  if (f === 'recommendations') { const a = record.recommendations; return Array.isArray(a) && a.length ? recommendationRows(a) : []; }
  const val = getFieldValue(record, f);
  if (!hasVal(val)) return [];
  if (DATE_FIELDS.includes(f)) return [{ value: `1. ${formatDate(val)}` }];
  if (ENUM_FIELDS.includes(f)) return [{ value: `1. ${enumCanonical(ENUM_OPTIONS[f] || [], val)}` }];
  if (SENTENCE_FIELDS.includes(f)) return sentenceRows(String(val));
  return [{ value: `1. ${fmtScalar(val)}` }];
}

const EndocrinologyAssessmentDocumentPDFTemplate = ({ document }) => {
  let records = [];
  if (document) {
    if (Array.isArray(document)) records = document;
    else if (document.records) records = document.records;
    else if (document.documentData) { const dd = document.documentData; records = Array.isArray(dd) ? dd : (dd.records || dd.data || [dd]); }
    else records = [document];
  }

  if (!records.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Endocrinology Assessment</Text>
          <Text style={styles.noRecords}>No endocrinology assessments available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Endocrinology Assessment</Text>
        {/* Flatten record children directly under <Page> — a per-record wrapper <View> is a
            keep-together unit react-pdf shoves WHOLE to the next page (page 1 = title only) when it
            fits a fresh page but not the post-title remainder. break={idx>0} on the record-title
            Text (a direct Page child) still paginates per record. (memory 6a4deac1 / Rule #74) */}
        {records.flatMap((record, idx) => {
          const els = [<Text key={`rt-${idx}`} style={styles.recordTitle} break={idx > 0}>{`Endocrinology Assessment ${idx + 1}`}</Text>];
          SECTION_ORDER.forEach(sid => {
            const present = SECTION_FIELDS[sid].filter(f => fieldRows(record, f).length > 0);
            if (!present.length) return;
            const title = SECTION_TITLES[sid];
            els.push(
              <View key={`${idx}-${sid}`} style={styles.section}>
                {present.map((f, i) => {
                  const rows = fieldRows(record, f);
                  const label = FIELD_LABELS[f] || f;
                  const showLabel = label.toLowerCase() !== title.toLowerCase();
                  return (
                    <View key={f} style={styles.fieldBlock} wrap={i === 0 ? false : rows.length > 22}>
                      {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
                      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
                      {rows.map((r, ri) => (r.sub != null
                        ? <Text key={ri} style={styles.subLabel}>{r.sub}</Text>
                        : <Text key={ri} style={styles.value}>{r.value}</Text>))}
                    </View>
                  );
                })}
              </View>
            );
          });
          return els;
        })}
      </Page>
    </Document>
  );
};

export default EndocrinologyAssessmentDocumentPDFTemplate;
