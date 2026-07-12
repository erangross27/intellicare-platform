/**
 * PregnancyComplicationsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE — box-free (underline rules, no boxes/tints)
 * Collection: pregnancy_complications
 *
 * Mirrors the JSX:
 *   - date                        → formatted date
 *   - iugr/poly/oligohydramnios   → Yes/No
 *   - 4 objects (hypertensiveDisorders, placentalComplications, pretermLabor, results)
 *                                 → recursive humanizeKey sub-labels; narrative string leaves split per-sentence
 *   - infections (array {type,status,notes}) → numbered recursive entries
 *   - recommendations (array {recommendation,date}) → date-grouped numbered list
 *   - findings/assessment/plan/notes → per-sentence numbered lines
 * Anti-orphan: each section renders as a FLAT list of small elements; the sectionTitle + first element are
 * glued inside one wrap={false} View, the rest flow — so wrap=false never wraps a page-tall subtree.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginTop: 8, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 8, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  recDate: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'header-info': 'Header Information',
  'clinical-info': 'Clinical Information',
  'hypertensive-disorders': 'Hypertensive Disorders',
  'placental-complications': 'Placental Complications',
  'preterm-labor': 'Preterm Labor',
  'fluid-status': 'Fluid Status',
  'infections': 'Infections',
  'results': 'Results',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  hypertensiveDisorders: 'Hypertensive Disorders',
  placentalComplications: 'Placental Complications',
  pretermLabor: 'Preterm Labor',
  results: 'Results',
  infections: 'Infections',
  recommendations: 'Recommendations',
  iugr: 'IUGR (Intrauterine Growth Restriction)',
  polyhydramnios: 'Polyhydramnios',
  oligohydramnios: 'Oligohydramnios',
};

const SECTION_FIELDS = {
  'header-info': ['date', 'provider', 'facility', 'status'],
  'clinical-info': ['findings', 'assessment', 'plan', 'notes'],
  'hypertensive-disorders': ['hypertensiveDisorders'],
  'placental-complications': ['placentalComplications'],
  'preterm-labor': ['pretermLabor'],
  'fluid-status': ['iugr', 'polyhydramnios', 'oligohydramnios'],
  'infections': ['infections'],
  'results': ['results'],
  'recommendations': ['recommendations'],
};

const SECTION_ORDER = ['header-info', 'clinical-info', 'hypertensive-disorders', 'placental-complications', 'preterm-labor', 'fluid-status', 'infections', 'results', 'recommendations'];

const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['iugr', 'polyhydramnios', 'oligohydramnios'];
const OBJECT_FIELDS = ['hypertensiveDisorders', 'placentalComplications', 'pretermLabor', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const INFECTION_ARRAY_FIELDS = ['infections'];

/* ======= UTILS ======= */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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

/* printable scrub for Helvetica (unicode escapes only — no invisible-char strip, record has none) */
const safeString = (s) => String(s == null ? '' : s)
  .replace(/×/g, 'x')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...');

/* canonical splitBySentence — [.;] + abbrev/single-initial/digit guards; paren-protect '.'/';' inside () */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const P1 = String.fromCharCode(1), P2 = String.fromCharCode(2);
  let depth = 0, masked = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; masked += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); masked += ch; }
    else if (depth > 0 && ch === '.') masked += P1;
    else if (depth > 0 && ch === ';') masked += P2;
    else masked += ch;
  }
  return masked
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(s => s.split(P1).join('.').split(P2).join(';').replace(/^\d+\.\s+/, '').trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* paren-aware comma split with thousands/year guard (keeps "138,000" / "1,050 g" / "46,XX" whole) */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* narrative string → flat Text elements (mirrors JSX formatSentenceFieldLines: labeled sub-label + numbered items) */
const narrativeElements = (raw, keyPrefix) => {
  const s = safeString(raw);
  const sentences = splitBySentence(s);
  const whole = parseLabel(s);
  const structured = sentences.length > 1 || (whole.isLabeled && splitByComma(whole.value).length >= 2);
  if (!structured) return [<Text key={`${keyPrefix}-v`} style={styles.value}>{s}</Text>];
  const out = []; let n = 1;
  sentences.forEach((sent, si) => {
    const p = parseLabel(sent);
    if (p.isLabeled) {
      const parts = splitByComma(p.value);
      out.push(<Text key={`${keyPrefix}-${si}-l`} style={styles.subLabel}>{p.label}</Text>);
      if (parts.length >= 2) parts.forEach((pt, pi) => out.push(<Text key={`${keyPrefix}-${si}-${pi}`} style={styles.listItem}>{n++}. {pt}</Text>));
      else out.push(<Text key={`${keyPrefix}-${si}-v`} style={styles.listItem}>{n++}. {p.value}</Text>);
    } else {
      out.push(<Text key={`${keyPrefix}-${si}`} style={styles.listItem}>{n++}. {sent}</Text>);
    }
  });
  return out;
};

/* recursive object node → flat Text elements (sub-labels + values; narrative strings split) */
const objectNodeElements = (label, value, keyPath) => {
  if (isEmptyDeep(value)) return [];
  const out = [];
  if (isScalar(value)) {
    if (label) out.push(<Text key={`${keyPath}-l`} style={styles.subLabel}>{label}</Text>);
    if (typeof value === 'string') out.push(...narrativeElements(value, keyPath));
    else out.push(<Text key={`${keyPath}-v`} style={styles.value}>{safeString(fmtScalar(value))}</Text>);
    return out;
  }
  if (Array.isArray(value)) {
    if (label) out.push(<Text key={`${keyPath}-l`} style={styles.subLabel}>{label}</Text>);
    value.filter(x => !isEmptyDeep(x)).forEach((v, i) => {
      if (isScalar(v)) out.push(<Text key={`${keyPath}-${i}`} style={styles.listItem}>{i + 1}. {safeString(fmtScalar(v))}</Text>);
      else out.push(...objectNodeElements('', v, `${keyPath}-${i}`));
    });
    return out;
  }
  if (label) out.push(<Text key={`${keyPath}-l`} style={styles.subLabel}>{label}</Text>);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectNodeElements(humanizeKey(k), v, `${keyPath}-${k}`)));
  return out;
};

/* one field → flat array of small Views/Texts (NO section title, NO wrap prop) */
const fieldElements = (record, field, sectionTitle) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const out = [];
  if (showLabel) out.push(<Text key={`${field}-fl`} style={styles.fieldLabel}>{label}</Text>);

  if (DATE_FIELDS.includes(field)) { out.push(<Text key={field} style={styles.value}>{formatDate(val)}</Text>); return out; }
  if (BOOLEAN_FIELDS.includes(field)) { out.push(<Text key={field} style={styles.value}>{val ? 'Yes' : 'No'}</Text>); return out; }

  if (OBJECT_ARRAY_FIELDS.includes(field)) {
    const recs = Array.isArray(val) ? val : [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    groups.forEach((g, gi) => {
      if (g.date) out.push(<Text key={`${field}-d${gi}`} style={styles.recDate}>{g.date}</Text>);
      g.items.forEach((r, i) => out.push(<Text key={`${field}-${gi}-${i}`} style={styles.listItem}>{i + 1}. {safeString((r?.recommendation || '').trim())}</Text>));
    });
    return out;
  }

  if (INFECTION_ARRAY_FIELDS.includes(field)) {
    const items = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    items.forEach((item, i) => {
      if (isScalar(item)) out.push(<Text key={`${field}-${i}`} style={styles.value}>{i + 1}. {safeString(fmtScalar(item))}</Text>);
      else {
        out.push(<Text key={`${field}-${i}-n`} style={styles.subLabel}>{i + 1}.</Text>);
        Object.entries(item).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectNodeElements(humanizeKey(k), v, `${field}-${i}-${k}`)));
      }
    });
    return out;
  }

  if (OBJECT_FIELDS.includes(field)) {
    Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectNodeElements(humanizeKey(k), v, `${field}-${k}`)));
    return out;
  }

  /* string (SENTENCE_FIELDS + provider/facility/etc.) */
  out.push(...narrativeElements(fmtVal(val), field));
  return out;
};

/* ======= RENDER SECTION — flatten, glue sectionTitle + first element in one wrap=false View ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = (SECTION_FIELDS[sid] || []).filter(f => hasVal(record[f]));
  if (fields.length === 0) return null;
  const els = [];
  fields.forEach(f => els.push(...fieldElements(record, f, title)));
  if (els.length === 0) return null;
  const [first, ...rest] = els;
  return (
    <View key={sid} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const PregnancyComplicationsDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].pregnancy_complications && Array.isArray(docProp[0].pregnancy_complications)) {
      records = docProp[0].pregnancy_complications;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.pregnancy_complications) {
    records = Array.isArray(docProp.pregnancy_complications) ? docProp.pregnancy_complications : [docProp.pregnancy_complications];
  } else if (docProp && docProp.documentData) {
    const dd = docProp.documentData;
    if (Array.isArray(dd)) records = dd;
    else if (dd?.pregnancy_complications) records = Array.isArray(dd.pregnancy_complications) ? dd.pregnancy_complications : [dd.pregnancy_complications];
    else if (dd && typeof dd === 'object') records = [dd];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pregnancy Complications</Text>
          <Text style={styles.noDataText}>No pregnancy complications data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pregnancy Complications</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{safeString(record.provider || `Pregnancy Complications ${idx + 1}`)}</Text>
            </View>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PregnancyComplicationsDocumentPDFTemplate;
