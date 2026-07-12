/**
 * PsychosocialFactorsDocumentPDFTemplate.jsx
 * Box-free canonical PDF - Helvetica - LETTER - psychosocial factors
 * Collection: psychosocial_factors
 *
 * Anti-orphan FLATTEN: each section flattens its fields into a flat array of small
 * <Text> elements; the sectionTitle + first element are glued in ONE wrap={false} View,
 * the rest flow. OBJECT field `results` flattened to humanized stacked lines;
 * recommendations (array of {recommendation, date}) rendered as a date-grouped numbered list.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 8, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

/* safeString: \u-escapes only (no literal smart-quotes / invisible chars) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s
    .replace(/\u00d7/g, 'x')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um')
    .replace(/\u00b0/g, ' deg').replace(/\u00b1/g, '+/-')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=').replace(/\u2192/g, '->');
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
const hasVal = (v) => !isEmptyDeep(v);
const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware comma split (mirrors the JSX template) */
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

const KEY_OVERRIDES = {};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

/* objectLines: flatten a dynamic-key object into [{depth,label,value}] (value=null for a nested header) */
const objectLines = (value, depth = 0, label = '') => {
  const out = [];
  if (isEmptyDeep(value)) return out;
  if (value === null || typeof value !== 'object') {
    out.push({ depth, label, value: fmtScalar(value) });
    return out;
  }
  if (Array.isArray(value)) {
    const flat = value.map(item => (item !== null && typeof item === 'object') ? (item.name || item.value || JSON.stringify(item)) : String(item)).join(', ');
    if (flat.trim() !== '') out.push({ depth, label, value: flat });
    return out;
  }
  if (label) out.push({ depth, label, value: null });
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    out.push(...objectLines(v, depth + (label ? 1 : 0), humanizeKey(k)));
  });
  return out;
};

/* ======= CONFIG (mirrors JSX) ======= */
const SECTION_TITLES = {
  'clinical-info': 'Clinical Information',
  'stressors': 'Stressors',
  'support': 'Support',
  'coping-strategies': 'Coping Strategies',
  'mental-health': 'Mental Health',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-status': 'Notes & Status',
};
const SECTION_ORDER = ['clinical-info', 'stressors', 'support', 'coping-strategies', 'mental-health', 'findings', 'assessment', 'plan', 'results-section', 'recommendations-section', 'notes-status'];
const SECTION_FIELDS = {
  'clinical-info': ['date', 'provider', 'facility'],
  'stressors': ['stressors'],
  'support': ['support'],
  'coping-strategies': ['copingStrategies'],
  'mental-health': ['mentalHealth'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-status': ['notes', 'status'],
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  stressors: 'Stressors', support: 'Support', copingStrategies: 'Coping Strategies',
  mentalHealth: 'Mental Health', findings: 'Findings', assessment: 'Assessment',
  plan: 'Plan', results: 'Results', recommendations: 'Recommendations',
  notes: 'Notes', status: 'Status',
};
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const labelEl = (f, label) => <Text key={`${f}-l`} style={styles.fieldLabel}>{safeString(label)}</Text>;

/* sentence field -> bare label + sentence/comma value lines (mirrors JSX renderStringField display) */
const sentenceEls = (f, val, showLabel, label) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const singleParsed = sentences.length === 1 ? parseLabel(sentences[0]) : null;
  const useMulti = sentences.length > 1 || (!!singleParsed && singleParsed.isLabeled && splitByComma(singleParsed.value).length >= 2);
  const els = [];
  if (showLabel) els.push(labelEl(f, label));
  if (!useMulti) {
    els.push(<Text key={`${f}-v`} style={styles.value}>{safeString(strVal)}</Text>);
    return els;
  }
  let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(<Text key={`${f}-sl${si}`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
      if (parts.length >= 2) parts.forEach((p, pi) => els.push(<Text key={`${f}-s${si}c${pi}`} style={styles.listItem}>{`${n++}. ${safeString(p)}`}</Text>));
      else els.push(<Text key={`${f}-s${si}v`} style={styles.listItem}>{`${n++}. ${safeString(parsed.value)}`}</Text>);
    } else {
      els.push(<Text key={`${f}-s${si}`} style={styles.listItem}>{`${n++}. ${safeString(s)}`}</Text>);
    }
  });
  return els;
};

/* date field -> bare label + formatted date */
const dateEls = (f, val, showLabel, label) => {
  const els = [];
  if (showLabel) els.push(labelEl(f, label));
  els.push(<Text key={`${f}-v`} style={styles.value}>{formatDate(val)}</Text>);
  return els;
};

/* recommendations (array of {recommendation, date}) -> label + date-grouped numbered list
   (numbering restarts at each date group; mirrors the JSX date-grouped display + Copy) */
const recommendationsEls = (val, showLabel, label) => {
  const recs = Array.isArray(val) ? val.filter(Boolean) : [];
  if (recs.length === 0) return [];
  const els = [];
  if (showLabel) els.push(labelEl('recommendations', label));
  let lastDate = null; let n = 1;
  recs.forEach((r, ri) => {
    const rec = (r?.recommendation || '').trim();
    const d = (r?.date || '').trim();
    if (d !== lastDate) { if (d) els.push(<Text key={`rec-d${ri}`} style={styles.subLabel}>{safeString(d)}</Text>); lastDate = d; n = 1; }
    els.push(<Text key={`rec-${ri}`} style={styles.listItem}>{`${n++}. ${safeString(rec)}`}</Text>);
  });
  return els;
};

/* results (dynamic-key object) -> flattened humanized stacked lines (label above value) */
const resultsEls = (val) => {
  if (!val || typeof val !== 'object' || isEmptyDeep(val)) return [];
  const lines = objectLines(val, 0, '');
  const els = [];
  lines.forEach((ln, i) => {
    if (ln.value === null) {
      els.push(<Text key={`res-h${i}`} style={styles.subLabel}>{safeString(ln.label)}</Text>);
    } else {
      if (ln.label) els.push(<Text key={`res-l${i}`} style={styles.subLabel}>{safeString(ln.label)}</Text>);
      els.push(<Text key={`res-v${i}`} style={styles.value}>{safeString(ln.value)}</Text>);
    }
  });
  return els;
};

/* dispatch one field -> flat element array */
const fieldEls = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const sectionTitle = SECTION_TITLES[sid] || '';
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== sectionTitle.trim().toLowerCase();
  if (OBJECT_ARRAY_FIELDS.includes(f)) return recommendationsEls(val, showLabel, label);
  if (OBJECT_FIELDS.includes(f)) return resultsEls(val);
  if (DATE_FIELDS.includes(f)) return dateEls(f, val, showLabel, label);
  return sentenceEls(f, val, showLabel, label);
};

/* ======= COMPONENT ======= */
const PsychosocialFactorsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.psychosocial_factors) return Array.isArray(r.psychosocial_factors) ? r.psychosocial_factors : [r.psychosocial_factors];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychosocial_factors) return Array.isArray(dd.psychosocial_factors) ? dd.psychosocial_factors : [dd.psychosocial_factors]; if (dd?.records) return Array.isArray(dd.records) ? dd.records : [dd.records]; return [dd]; }
      if (r?.records) return Array.isArray(r.records) ? r.records : [r.records];
      if (r?._records) return Array.isArray(r._records) ? r._records : [r._records];
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychosocial Factors</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychosocial Factors</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{safeString(`Psychosocial Factor ${index + 1}`)}</Text>
            </View>

            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid] || [];
              const flat = [];
              fields.forEach(f => flat.push(...fieldEls(record, f, sid)));
              if (flat.length === 0) return null;
              const first = React.cloneElement(flat[0], { key: 'f0' });
              const rest = flat.slice(1).map((el, i) => React.cloneElement(el, { key: `f${i + 1}` }));
              return (
                <View key={sid} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                    {first}
                  </View>
                  {rest}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PsychosocialFactorsDocumentPDFTemplate;
