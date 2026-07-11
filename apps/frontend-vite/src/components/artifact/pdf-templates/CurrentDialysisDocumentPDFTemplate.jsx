/**
 * CurrentDialysisDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1: wrap = BOOLEANS; recordContainer paddingBottom only + break={idx>0} (Rule #75);
 * sectionTitle rides INSIDE the section's wrap-gated View (anti-orphan).
 * 4-area mirror of the JSX/copy: canonical splitBySentence ([;.] + abbrev guard); EQ/DASH numbered;
 * OBJECT fields → sub-label(key) + numbered value; arrays/date/enum numbered; single-name label hidden.
 * Collection: current_dialysis
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
  'dialysisInfo': 'Dialysis Information',
  'prescription-section': 'Prescription',
  'adequacy-section': 'Adequacy',
  'pd-details': 'Peritoneal Dialysis Details',
  'complications-section': 'Complications',
  'clinical': 'Clinical',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-section': 'Notes',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', modality: 'Modality', schedule: 'Schedule', status: 'Status',
  prescription: 'Prescription', adequacy: 'Adequacy', pdDetails: 'Peritoneal Dialysis Details', complications: 'Complications',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', results: 'Results', recommendations: 'Recommendations', notes: 'Notes',
};
const SECTION_FIELDS = {
  'dialysisInfo': ['date', 'provider', 'facility', 'modality', 'schedule', 'status'],
  'prescription-section': ['prescription'],
  'adequacy-section': ['adequacy'],
  'pd-details': ['pdDetails'],
  'complications-section': ['complications'],
  'clinical': ['findings', 'assessment', 'plan'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-section': ['notes'],
};
const SECTION_ORDER = ['dialysisInfo', 'prescription-section', 'adequacy-section', 'pd-details', 'complications-section', 'clinical', 'results-section', 'recommendations-section', 'notes-section'];
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['prescription', 'adequacy', 'pdDetails', 'results'];
const STRING_ARRAY_FIELDS = ['complications'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const ENUM_FIELDS = { modality: ['HD', 'PD', 'CRRT', 'HDF'], status: ['Active', 'Not Active'] };

const KEY_OVERRIDES = { ktv: 'Kt/V', urr: 'URR', hd: 'HD', pd: 'PD', crrt: 'CRRT', uf: 'UF', ufgoal: 'UF Goal' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const fmtEnumVal = (f, v) => { const opts = ENUM_FIELDS[f]; if (opts) { const hit = opts.find(o => o.toLowerCase() === String(v ?? '').toLowerCase().trim()); if (hit) return hit; } return null; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

/* recursive object → {k:'sub'|'row', t} lines: each scalar leaf → sub-label(key) + "1. value"; nested → sub-label + recurse. */
const objectLinesPdf = (value) => {
  const out = [];
  if (!value || typeof value !== 'object') return out;
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    const key = humanizeKey(k);
    if (isScalar(v)) { out.push({ k: 'sub', t: key }, { k: 'row', t: `1. ${fmtScalar(v)}` }); }
    else if (Array.isArray(v)) { out.push({ k: 'sub', t: key }); v.filter(x => !isEmptyDeep(x)).forEach((it, i) => { if (isScalar(it)) out.push({ k: 'row', t: `${i + 1}. ${fmtScalar(it)}` }); else objectLinesPdf(it).forEach(l => out.push(l)); }); }
    else { out.push({ k: 'sub', t: key }); objectLinesPdf(v).forEach(l => out.push(l)); }
  });
  return out;
};

/* Build {k:'label'|'sub'|'row', t} lines for one field — the exact mirror of buildFieldLines. */
const fieldLines = (record, f, sectionTitle) => {
  const label = FIELD_LABELS[f] || f;
  const val = record[f];
  const lines = [];
  if (!hasVal(val)) return lines;
  const showLabel = label.toLowerCase() !== String(sectionTitle || '').toLowerCase();
  const head = showLabel ? [{ k: 'label', t: label }] : [];
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const recs = Array.isArray(val) ? val.filter(Boolean) : [];
    if (recs.length === 0) return lines;
    lines.push(...head);
    let lastDate = null; let n = 0;
    recs.forEach(r => { const rec = (r?.recommendation || '').trim(); const date = (r?.date || '').trim(); if (date !== lastDate) { if (date) { lines.push({ k: 'sub', t: date }); n = 0; } lastDate = date; } lines.push({ k: 'row', t: `${++n}. ${rec}` }); });
  } else if (STRING_ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
    if (items.length === 0) return lines;
    lines.push(...head);
    items.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${fmtVal(item)}` }));
  } else if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return lines;
    lines.push(...head);
    objectLinesPdf(val).forEach(l => lines.push(l));
  } else if (DATE_FIELDS.includes(f)) {
    lines.push(...head, { k: 'row', t: `1. ${formatDate(val)}` });
  } else {
    const strVal = ENUM_FIELDS[f] ? (fmtEnumVal(f, val) ?? fmtVal(val)) : fmtVal(val);
    const sentences = SENTENCE_FIELDS.includes(f) ? splitBySentence(strVal) : [strVal];
    lines.push(...head);
    if (sentences.length > 1) sentences.forEach((s, i) => lines.push({ k: 'row', t: `${i + 1}. ${s}` }));
    else lines.push({ k: 'row', t: `1. ${strVal}` });
  }
  return lines;
};

const CurrentDialysisDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.current_dialysis) return Array.isArray(r.current_dialysis) ? r.current_dialysis : [r.current_dialysis];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.current_dialysis) return Array.isArray(dd.current_dialysis) ? dd.current_dialysis : [dd.current_dialysis]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Current Dialysis</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Current Dialysis</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Current Dialysis ${String(record._recordNumber || idx + 1)}`}</Text>
            </View>
            {SECTION_ORDER.map(sid => {
              const title = SECTION_TITLES[sid];
              const lines = (SECTION_FIELDS[sid] || []).flatMap(f => fieldLines(record, f, title));
              if (lines.length === 0) return null;
              return (
                <View key={sid} style={styles.section} wrap={lines.length > 18 ? true : false}>
                  <Text style={styles.sectionTitle}>{title}</Text>
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

export default CurrentDialysisDocumentPDFTemplate;
