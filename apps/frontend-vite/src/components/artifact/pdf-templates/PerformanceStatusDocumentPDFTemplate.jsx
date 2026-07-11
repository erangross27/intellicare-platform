/**
 * PerformanceStatusDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical) — mirrors the JSX field-for-field: date as a real record field,
 * status enum canonical display, ECOG/Karnofsky/Lansky numbers, values numbered ('1.' even singles),
 * single-name label gate, narratives split on [.;]. Multi-record: each assessment breaks to a new page.
 * Rule #74: each field is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first View.
 * safeString uses ONLY \uXXXX escapes (no literal non-ASCII bytes).
 * Collection: performance_status
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['assessment-info', 'performance-scores', 'functional-capacity', 'provider-info', 'clinical-findings', 'clinical-assessment', 'monitoring-plan', 'additional-notes'];
const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'performance-scores': 'Performance Scores',
  'functional-capacity': 'Functional Capacity',
  'provider-info': 'Provider Information',
  'clinical-findings': 'Clinical Findings',
  'clinical-assessment': 'Clinical Assessment',
  'monitoring-plan': 'Monitoring Plan',
  'additional-notes': 'Additional Notes',
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', status: 'Status',
  karnofsky: 'Karnofsky (KPS)', ecog: 'ECOG', lansky: 'Lansky',
  functionalCapacity: 'Functional Capacity',
  provider: 'Provider', facility: 'Facility',
  findings: 'Clinical Findings', assessment: 'Clinical Assessment',
  plan: 'Monitoring Plan', notes: 'Additional Notes',
};
const SECTION_FIELDS = {
  'assessment-info': ['date', 'type', 'status'],
  'performance-scores': ['karnofsky', 'ecog', 'lansky'],
  'functional-capacity': ['functionalCapacity'],
  'provider-info': ['provider', 'facility'],
  'clinical-findings': ['findings'],
  'clinical-assessment': ['assessment'],
  'monitoring-plan': ['plan'],
  'additional-notes': ['notes'],
};
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['karnofsky', 'ecog', 'lansky'];
const ENUM_FIELDS = ['status'];
const ENUM_OPTIONS = { status: ['Active', 'Completed', 'Not Active'] };
const enumCanonical = (options, val) => { const cur = String(val ?? '').trim(); const hit = (options || []).find(o => o.toLowerCase() === cur.toLowerCase()); return hit || cur; };

/* HELPERS (mirror the JSX) */
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* safeString: normalize common non-ASCII glyphs to ASCII. Regex uses ONLY \uXXXX escapes -
   never paste a literal smart-quote / em-dash / BOM into this source. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00B5\u03BC]m/g, 'um')
    .replace(/[\u00B5\u03BC]g/g, 'mcg')
    .replace(/[\u00B5\u03BC]/g, 'u')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->')
    .replace(/[\u00D7\u2715\u2716]/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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

const sentenceRows = (text) => {
  const strip = (x) => String(x).replace(/[;.]+$/, '').trim();
  const rows = []; let n = 1;
  splitBySentence(text).forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = parts.length >= 2 ? parts : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(strip(it)), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

/* Rule #74: render a field as ONE wrap={false} atomic View; sectionTitle rides inside the first View. */
const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(formatDate(val))}</Text>;
  } else if (ENUM_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(enumCanonical(ENUM_OPTIONS[f], fmtScalar(val)))}</Text>;
  } else if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(fmtScalar(val))}</Text>;
  } else {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {body}
    </View>
  )];
};

const PerformanceStatusDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].performance_status && Array.isArray(templateData[0].performance_status)) records = templateData[0].performance_status;
    else records = templateData;
  } else if (templateData && templateData.performance_status) {
    records = Array.isArray(templateData.performance_status) ? templateData.performance_status : [templateData.performance_status];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.performance_status ? (Array.isArray(dd.performance_status) ? dd.performance_status : [dd.performance_status]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Performance Status</Text></View>
        <Text style={styles.emptyState}>No performance status data available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Performance Status</Text></View>
        {records.map((record, idx) => {
          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => hasVal(typeof r === 'string' ? r : (r && r.recommendation))) : [];
          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>{`Performance Status Assessment ${idx + 1}`}</Text>
              {SECTION_ORDER.map((sid) => {
                const vis = (SECTION_FIELDS[sid] || []).filter(f => hasVal(record[f]));
                if (vis.length === 0) return null;
                return (
                  <View key={sid} style={styles.section}>
                    {vis.flatMap((f, fi) => renderField(record, f, SECTION_TITLES[sid], fi === 0))}
                  </View>
                );
              })}
              {recs.length > 0 && (
                <View style={styles.section}>
                  {recs.map((rec, ri) => {
                    const text = typeof rec === 'string' ? rec : (rec.recommendation || '');
                    const date = typeof rec === 'string' ? null : rec.date;
                    return (
                      <View key={ri} style={styles.fieldGroup} wrap={false}>
                        {ri === 0 && <Text style={styles.sectionTitle}>Recommendations</Text>}
                        {date && <Text style={styles.subLabel}>{safeString(formatDate(date))}</Text>}
                        <Text style={styles.value}>{ri + 1}. {safeString(text)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PerformanceStatusDocumentPDFTemplate;
