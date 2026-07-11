import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ObstetricHistoryDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Arrays-of-objects (previousPregnancies, pregnancyLosses) decompose into a per-object fieldLabel
 * (Pregnancy N / Loss N) + sub-label + value rows; nested complications[] render as a value list.
 * results is a dynamic-key object -> generic recursive objectRows. Record date is `date` - NEVER
 * createdAt/updatedAt. safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars).
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
const SECTION_ORDER = ['record-info', 'obstetric-summary', 'previous-pregnancies', 'pregnancy-losses', 'findings', 'assessment', 'plan', 'results', 'tail'];

const SECTION_TITLES = {
  'record-info': 'Record Information',
  'obstetric-summary': 'Obstetric Summary',
  'previous-pregnancies': 'Previous Pregnancies',
  'pregnancy-losses': 'Pregnancy Losses',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'results': 'Results',
  'tail': 'Additional Information',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  gravida: 'Gravida',
  para: 'Para',
  gpNotation: 'G/P Notation',
  livingChildren: 'Living Children',
  previousPregnancies: 'Previous Pregnancies',
  pregnancyLosses: 'Pregnancy Losses',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility', 'status'],
  'obstetric-summary': ['gravida', 'para', 'gpNotation', 'livingChildren'],
  'previous-pregnancies': ['previousPregnancies'],
  'pregnancy-losses': ['pregnancyLosses'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'results': ['results'],
  'tail': ['recommendations', 'notes'],
};

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['gravida', 'para', 'livingChildren'];
const OBJECT_ARRAY_FIELDS = ['previousPregnancies', 'pregnancyLosses'];
const SIMPLE_ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['results'];

const PREG_SUBFIELDS = [['year', 'Year'], ['outcome', 'Outcome'], ['gestationalAge', 'Gestational Age'], ['deliveryMode', 'Delivery Mode']];
const LOSS_SUBFIELDS = [['type', 'Type'], ['year', 'Year'], ['gestationalAge', 'Gestational Age']];

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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const humanizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase());
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

/* generic recursive renderer for the dynamic-key `results` object (content-gated, empty-{} guarded) */
const objectRows = (obj, depth) => {
  const rows = [];
  Object.entries(obj).forEach(([k, v]) => {
    if (!hasVal(v)) return;
    const label = humanizeKey(k);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = objectRows(v, depth + 1);
      if (!inner.length) return;
      rows.push(<Text key={k} style={styles.subLabel}>{safeString(label)}</Text>);
      inner.forEach(r => rows.push(r));
    } else if (Array.isArray(v)) {
      const items = v.filter(x => hasVal(x));
      if (!items.length) return;
      rows.push(<Text key={k} style={styles.subLabel}>{safeString(label)}</Text>);
      items.forEach((it, ii) => rows.push(<Text key={k + ii} style={styles.value}>{safeString((it && typeof it === 'object') ? JSON.stringify(it) : String(it))}</Text>));
    } else {
      rows.push(<Text key={k} style={styles.subLabel}>{safeString(label)}</Text>);
      rows.push(<Text key={k + 'v'} style={styles.value}>{safeString(String(v))}</Text>);
    }
  });
  return rows;
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(x => x && typeof x === 'object' && hasVal(x)).length > 0;
  if (SIMPLE_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(x => hasVal(x)).length > 0;
  if (OBJECT_FIELDS.includes(f)) return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0;
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (SIMPLE_ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).map(x => (x && typeof x === 'object') ? (x.recommendation || '') : String(x)).filter(x => x && x.trim());
    return items.map((it, i) => <Text key={i} style={styles.value}>{safeString(it)}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

/* previousPregnancies - each object -> a wrap=false View (fieldLabel + sub-label/value rows + complications list) */
const pregnancyViews = (val, title) => {
  const items = (Array.isArray(val) ? val : []).filter(p => p && typeof p === 'object');
  if (items.length === 0) return null;
  return items.map((preg, i) => {
    const rows = [];
    PREG_SUBFIELDS.forEach(([k, lab]) => {
      if (!hasVal(preg[k])) return;
      rows.push(<Text key={k} style={styles.subLabel}>{safeString(lab)}</Text>);
      rows.push(<Text key={k + 'v'} style={styles.value}>{safeString(String(preg[k]))}</Text>);
    });
    const comps = Array.isArray(preg.complications) ? preg.complications.filter(c => hasVal(c)) : [];
    if (comps.length) {
      rows.push(<Text key="comp" style={styles.subLabel}>{safeString('Complications')}</Text>);
      comps.forEach((c, ci) => rows.push(<Text key={'c' + ci} style={styles.value}>{safeString(String(c))}</Text>));
    }
    return (
      <View key={i} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(title)}</Text>}
        <Text style={styles.fieldLabel}>{safeString(`Pregnancy ${i + 1}${preg.year ? ` (${preg.year})` : ''}`)}</Text>
        {rows}
      </View>
    );
  });
};

/* pregnancyLosses - each object (or string) -> a wrap=false View (fieldLabel + sub-label/value rows) */
const lossViews = (val, title) => {
  const items = (Array.isArray(val) ? val : []).filter(l => l && (typeof l === 'object' || (typeof l === 'string' && l.trim())));
  if (items.length === 0) return null;
  return items.map((loss, i) => {
    const rows = [];
    if (typeof loss === 'string') {
      rows.push(<Text key="s" style={styles.value}>{safeString(loss)}</Text>);
    } else {
      LOSS_SUBFIELDS.forEach(([k, lab]) => {
        if (!hasVal(loss[k])) return;
        rows.push(<Text key={k} style={styles.subLabel}>{safeString(lab)}</Text>);
        rows.push(<Text key={k + 'v'} style={styles.value}>{safeString(String(loss[k]))}</Text>);
      });
    }
    const titleTxt = (typeof loss === 'object' && loss.type) ? `Loss ${i + 1} - ${loss.type}` : `Loss ${i + 1}`;
    return (
      <View key={i} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(title)}</Text>}
        <Text style={styles.fieldLabel}>{safeString(titleTxt)}</Text>
        {rows}
      </View>
    );
  });
};

const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];

  if (sid === 'previous-pregnancies') return pregnancyViews(record.previousPregnancies, title);
  if (sid === 'pregnancy-losses') return lossViews(record.pregnancyLosses, title);
  if (sid === 'results') {
    const obj = record.results;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).length === 0) return null;
    const inner = objectRows(obj, 0);
    if (!inner.length) return null;
    return (
      <View key={sid} style={styles.fieldWrap} wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {inner}
      </View>
    );
  }

  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
  if (present.length === 0) return null;
  return present.map((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (title || '').trim().toLowerCase();
    return (
      <View key={f} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(title)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {fieldBody(record, f)}
      </View>
    );
  });
};

const ObstetricHistoryDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.obstetric_history) records = Array.isArray(data[0].obstetric_history) ? data[0].obstetric_history : [data[0].obstetric_history];
    else records = data;
  } else if (data?.obstetric_history) records = Array.isArray(data.obstetric_history) ? data.obstetric_history : [data.obstetric_history];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Obstetric History</Text>
          <Text style={styles.noData}>No obstetric history records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Obstetric History</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Obstetric History ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default ObstetricHistoryDocumentPDFTemplate;
