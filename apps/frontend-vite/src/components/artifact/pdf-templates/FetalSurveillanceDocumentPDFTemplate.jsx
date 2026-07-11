/**
 * FetalSurveillanceDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: real record.date (never createdAt),
 * values numbered ('1.' even singles), single-name label gate, OBJECT leaves stacked (sub-label + numbered
 * value, never "key: value"), nst/bpp object-arrays + recommendations date-grouped. Collection: fetal_surveillance
 *
 * Rule #74: each field is ONE wrap={false} atomic View; the sectionTitle rides INSIDE the first present
 * field's View (anti-orphan). splitBySentence splits on [.;]. PHI footer is STATIC only.
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
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 0.5, borderLeftColor: '#999999', marginTop: 2 },
  recDate: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_CONFIG = [
  { title: 'Clinical Information', fields: ['date', 'provider', 'facility', 'type', 'status'] },
  { title: 'Kick Counts', fields: ['kickCounts'] },
  { title: 'Findings', fields: ['findings'] },
  { title: 'Assessment', fields: ['assessment'] },
  { title: 'Plan', fields: ['plan'] },
  { title: 'Recommendations', fields: ['recommendations'] },
  { title: 'Contraction Stress Test (CST)', fields: ['cst'] },
  { title: 'Results', fields: ['results'] },
  { title: 'Notes', fields: ['notes'] },
  { title: 'Non-Stress Test (NST)', fields: ['nst'] },
  { title: 'Biophysical Profile (BPP)', fields: ['bpp'] },
];
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', type: 'Type', status: 'Status',
  kickCounts: 'Kick Counts', findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', results: 'Results', cst: 'Contraction Stress Test (CST)',
  notes: 'Notes', nst: 'Non-Stress Test (NST)', bpp: 'Biophysical Profile (BPP)',
};
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['cst', 'results'];
const OBJECT_ARRAY_FIELDS = ['nst', 'bpp'];
const RECOMMENDATIONS_FIELDS = ['recommendations'];

const KEY_OVERRIDES = { nst: 'NST', bpp: 'BPP', cst: 'CST', fhr: 'FHR', bpm: 'BPM' };
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
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
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

/* recursive object node: sub-label heading + numbered value line (STACKED, never "key: value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>1. {safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* STRING rows: LABELED sentence → subtitle + >=2 comma rows; UNLABELED single sentence >=3 comma → numbered;
   otherwise one whole numbered row per sentence. */
const stringRows = (text) => {
  const strip = (x) => x.replace(/[;.]+$/, '').trim();
  const strVal = fmtVal(text);
  const sentences = splitBySentence(strVal);
  const single = parseLabel(strVal);
  if (sentences.length <= 1 && !single.isLabeled) {
    const commaItems = splitByComma(strVal);
    if (commaItems.length >= 3) return commaItems.map((c, i) => ({ type: 'item', text: safeString(strip(c)), num: i + 1 }));
    return [{ type: 'item', text: safeString(strVal), num: 1 }];
  }
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = (parts.length >= 2 ? parts : [parsed.value]).map(strip);
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(it), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

const fieldVisible = (record, fn) => {
  const val = record[fn];
  if (OBJECT_ARRAY_FIELDS.includes(fn) || RECOMMENDATIONS_FIELDS.includes(fn)) return Array.isArray(val) && val.filter(x => !isEmptyDeep(x)).length > 0;
  if (OBJECT_FIELDS.includes(fn)) return hasVal(val) && !isScalar(val) && !isEmptyDeep(val);
  return hasVal(val);
};

/* Rule #74: render a field as wrap={false} atomic View(s); sectionTitle rides inside the first View.
   The field label is suppressed when it equals the section title (single-name gate). */
const renderField = (record, fn, sectionTitle, isFirst) => {
  const val = record[fn];
  if (!fieldVisible(record, fn)) return [];
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(fn)) {
    return [(
      <View key={fn} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>1. {formatDate(val)}</Text>
      </View>
    )];
  }
  if (RECOMMENDATIONS_FIELDS.includes(fn)) {
    const recs = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={fn} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.value}>{i + 1}. {safeString((r?.recommendation || '').trim())}</Text>))}
          </View>
        ))}
      </View>
    )];
  }
  if (OBJECT_ARRAY_FIELDS.includes(fn)) {
    const arr = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (arr.length === 0) return [];
    return arr.map((item, i) => (
      <View key={`${fn}-${i}`} style={styles.fieldGroup} wrap={false}>
        {i === 0 ? titleNode : null}
        {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        <Text style={styles.subLabel}>{`${humanizeKey(fn)} ${i + 1}`}</Text>
        {isScalar(item) ? <Text style={styles.value}>1. {safeString(fmtScalar(item))}</Text> : renderObjectNode(null, item, `${fn}-${i}`, 1)}
      </View>
    ));
  }
  if (OBJECT_FIELDS.includes(fn)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => (
      <View key={`${fn}-${k}`} style={styles.fieldGroup} wrap={false}>
        {i === 0 ? titleNode : null}
        {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {renderObjectNode(humanizeKey(k), v, `${fn}-${k}`, 1)}
      </View>
    ));
  }

  /* string */
  const rows = stringRows(val);
  return [(
    <View key={fn} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)}
    </View>
  )];
};

const FetalSurveillanceDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.fetal_surveillance) return Array.isArray(r.fetal_surveillance) ? r.fetal_surveillance : [r.fetal_surveillance];
      if (r?.records) return Array.isArray(r.records) ? r.records : [r.records];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.fetal_surveillance) return Array.isArray(dd.fetal_surveillance) ? dd.fetal_surveillance : [dd.fetal_surveillance]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object').map(record => {
      const clean = {}; for (const k of Object.keys(record)) { if (!k.startsWith('_')) clean[k] = record[k]; } return clean;
    });
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fetal Surveillance</Text></View>
        <Text style={styles.emptyState}>No data available</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fetal Surveillance</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Fetal Surveillance ${idx + 1}`}</Text>
            {SECTION_CONFIG.map((section, sIdx) => {
              const vis = section.fields.filter(f => fieldVisible(record, f));
              if (vis.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  {vis.flatMap((f, fi) => renderField(record, f, section.title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FetalSurveillanceDocumentPDFTemplate;
