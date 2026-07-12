/**
 * PsychiatricReviewDocumentPDFTemplate.jsx
 * Box-free canonical PDF — Helvetica — LETTER — psychiatric review
 * Collection: psychiatric_review
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

/* safeString: \u-escapes only (no literal smart-quotes / invisible chars — memory 6a4f...) */
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

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const safeArray = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const stripNumber = (t) => t ? String(t).replace(/^\d+[.)]\s*/, '') : t;

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
};

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
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const KEY_OVERRIDES = {
  ekg: 'EKG', ecg: 'ECG', bmi: 'BMI', tsh: 'TSH', ldl: 'LDL', hdl: 'HDL', qtc: 'QTc',
  id: 'ID', url: 'URL',
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isObjEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isObjEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isObjEmptyDeep);
  return false;
};

/* objectLines: flatten a dynamic-key object into [{depth,label,value}] (value=null for a nested header) */
const objectLines = (value, depth = 0, label = '') => {
  const out = [];
  if (isObjEmptyDeep(value)) return out;
  if (value === null || typeof value !== 'object') {
    out.push({ depth, label, value: fmtVal(value) });
    return out;
  }
  if (label) out.push({ depth, label, value: null });
  Object.entries(value).filter(([, v]) => !isObjEmptyDeep(v)).forEach(([k, v]) => {
    out.push(...objectLines(v, depth + (label ? 1 : 0), humanizeKey(k)));
  });
  return out;
};

/* ======= CONFIG ======= */
const SECTION_TITLES = {
  'visit-info': 'Visit Information',
  'medication-review': 'Medication Review',
  'lab-monitoring': 'Lab Monitoring',
  'clinical-assessment': 'Clinical Assessment',
  management: 'Management',
  results: 'Results',
};
const SECTION_ORDER = ['visit-info', 'medication-review', 'lab-monitoring', 'clinical-assessment', 'management', 'results'];
const SECTION_FIELDS = {
  'visit-info': ['date', 'type', 'provider', 'facility', 'status'],
  'medication-review': ['lastPsychiatristVisit', 'medicationCompliance', 'medicationSideEffects', 'therapeuticResponse'],
  'lab-monitoring': ['bloodLevels', 'metabolicMonitoring', 'ekg', 'geneticTesting'],
  'clinical-assessment': ['findings', 'assessment'],
  management: ['plan', 'notes', 'recommendations'],
  results: ['results'],
};
const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  lastPsychiatristVisit: 'Last Psychiatrist Visit',
  medicationCompliance: 'Medication Compliance',
  medicationSideEffects: 'Medication Side Effects',
  therapeuticResponse: 'Therapeutic Response',
  bloodLevels: 'Blood Levels',
  metabolicMonitoring: 'Metabolic Monitoring',
  ekg: 'EKG',
  geneticTesting: 'Genetic Testing',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  recommendations: 'Recommendations',
  results: 'Results',
};
const DATE_FIELDS = ['date'];
const SEMICOLON_FIELDS = ['medicationCompliance', 'plan'];
const SENTENCE_FIELDS = ['therapeuticResponse', 'findings', 'assessment', 'notes'];
const ARRAY_FIELDS = ['medicationSideEffects'];
const BLOOD_LEVEL_SUB_FIELDS = [
  { key: 'level', label: 'Level' },
  { key: 'date', label: 'Date' },
  { key: 'therapeutic', label: 'Therapeutic' },
];
const METABOLIC_LABELS = {
  weight: 'Weight',
  glucose: 'Glucose',
  lipids: 'Lipids',
  prolactin: 'Prolactin',
  thyroid: 'Thyroid',
};

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const labelEl = (f) => <Text key={`${f}-l`} style={styles.fieldLabel}>{FIELD_LABELS[f] || f}</Text>;

/* simple single-value string field → bare label + value line */
const stringEls = (f, val, showLabel) => {
  const els = [];
  if (showLabel) els.push(labelEl(f));
  els.push(<Text key={`${f}-v`} style={styles.value}>{safeString(fmtVal(val))}</Text>);
  return els;
};

/* sentence field → bare label + sentence/comma value lines (mirrors JSX renderSentenceEditableField display) */
const sentenceEls = (f, val, showLabel) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const els = [];
  if (showLabel) els.push(labelEl(f));
  if (sentences.length <= 1) {
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

/* semicolon field (medicationCompliance, plan) → bare label + numbered items */
const semicolonEls = (f, val, showLabel) => {
  const parts = splitBySemicolon(String(val));
  const els = [];
  if (showLabel) els.push(labelEl(f));
  if (parts.length <= 1) { els.push(<Text key={`${f}-v`} style={styles.value}>{safeString(fmtVal(val))}</Text>); return els; }
  parts.forEach((p, i) => els.push(<Text key={`${f}-${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(stripNumber(p))}`}</Text>));
  return els;
};

/* plain string array (medicationSideEffects) → bare label + one numbered line per item */
const arrayEls = (f, val, showLabel) => {
  const items = safeArray(val);
  if (items.length === 0) return [];
  const els = [];
  if (showLabel) els.push(labelEl(f));
  items.forEach((item, i) => els.push(<Text key={`${f}-${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(stripNumber(fmtVal(item)))}`}</Text>));
  return els;
};

/* bloodLevels (array of {medication, level, date, therapeutic}) → label + numbered medication groups + stacked sub-fields */
const bloodLevelsEls = (val) => {
  const levels = safeArray(val);
  if (levels.length === 0) return [];
  const els = [<Text key="bl-l" style={styles.fieldLabel}>Blood Levels</Text>];
  levels.forEach((bl, bi) => {
    els.push(<Text key={`bl-${bi}`} style={styles.subLabel}>{`${bi + 1}. ${safeString(bl.medication || `Blood Level ${bi + 1}`)}`}</Text>);
    BLOOD_LEVEL_SUB_FIELDS.forEach(sf => {
      if (!hasVal(bl[sf.key])) return;
      els.push(<Text key={`bl-${bi}-${sf.key}`} style={styles.value}>{`${sf.label}: ${safeString(fmtVal(bl[sf.key]))}`}</Text>);
    });
  });
  return els;
};

/* metabolicMonitoring (nested object) → label + one label:value line per metabolic key */
const metabolicEls = (val) => {
  if (!val || typeof val !== 'object') return [];
  const entries = Object.entries(val).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return [];
  const els = [<Text key="meta-l" style={styles.fieldLabel}>Metabolic Monitoring</Text>];
  entries.forEach(([k, v]) => {
    els.push(<Text key={`meta-${k}`} style={styles.value}>{`${METABOLIC_LABELS[k] || humanizeKey(k)}: ${safeString(fmtVal(v))}`}</Text>);
  });
  return els;
};

/* recommendations (array of {recommendation, date}) → label + one numbered line per item */
const recommendationsEls = (val) => {
  const items = safeArray(val);
  if (items.length === 0) return [];
  const els = [<Text key="rec-l" style={styles.fieldLabel}>Recommendations</Text>];
  items.forEach((rec, ri) => {
    const t = rec.recommendation || `Recommendation ${ri + 1}`;
    const dt = rec.date ? ` (${formatDate(rec.date)})` : '';
    els.push(<Text key={`rec-${ri}`} style={styles.listItem}>{`${ri + 1}. ${safeString(`${t}${dt}`)}`}</Text>);
  });
  return els;
};

/* results (dynamic-key object) → flattened humanized lines */
const resultsEls = (val) => {
  if (!val || typeof val !== 'object' || isObjEmptyDeep(val)) return [];
  const lines = objectLines(val, 0, '');
  return lines.map((ln, i) => (
    ln.value === null
      ? <Text key={`res-${i}`} style={styles.subLabel}>{safeString(ln.label)}</Text>
      : <Text key={`res-${i}`} style={styles.value}>{`${safeString(ln.label)}: ${safeString(ln.value)}`}</Text>
  ));
};

/* dispatch one field → flat element array */
const fieldEls = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  if (f === 'bloodLevels') return bloodLevelsEls(val);
  if (f === 'metabolicMonitoring') return metabolicEls(val);
  if (f === 'recommendations') return recommendationsEls(val);
  if (f === 'results') return resultsEls(val);
  const sectionTitle = SECTION_TITLES[sid] || '';
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
  if (DATE_FIELDS.includes(f)) return [labelEl(f), <Text key={`${f}-v`} style={styles.value}>{formatDate(val)}</Text>];
  if (ARRAY_FIELDS.includes(f)) return arrayEls(f, val, showLabel);
  if (SEMICOLON_FIELDS.includes(f)) return semicolonEls(f, val, showLabel);
  if (SENTENCE_FIELDS.includes(f)) return sentenceEls(f, val, showLabel);
  return stringEls(f, val, showLabel);
};

/* ======= COMPONENT ======= */
const PsychiatricReviewDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.psychiatric_review) return Array.isArray(r.psychiatric_review) ? r.psychiatric_review : [r.psychiatric_review];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_review) return Array.isArray(dd.psychiatric_review) ? dd.psychiatric_review : [dd.psychiatric_review]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychiatric Review</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychiatric Review</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Psychiatric Review ${index + 1}`}</Text>
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

export default PsychiatricReviewDocumentPDFTemplate;
