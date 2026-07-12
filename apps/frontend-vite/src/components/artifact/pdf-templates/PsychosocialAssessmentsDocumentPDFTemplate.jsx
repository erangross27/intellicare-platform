/**
 * PsychosocialAssessmentsDocumentPDFTemplate.jsx
 * Box-free canonical PDF — Helvetica — LETTER — psychosocial assessments
 * Collection: psychosocial_assessments
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

/* splitByComma: parenthesis-aware with Oxford ("and"/"or") + numeric-thousands ("$12,500") guards */
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
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const humanizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
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
  if (Array.isArray(value)) {
    const flat = value.map(item => (item !== null && typeof item === 'object') ? (item.name || item.value || JSON.stringify(item)) : String(item)).join(', ');
    if (flat.trim() !== '') out.push({ depth, label, value: flat });
    return out;
  }
  if (label) out.push({ depth, label, value: null });
  Object.entries(value).filter(([, v]) => !isObjEmptyDeep(v)).forEach(([k, v]) => {
    out.push(...objectLines(v, depth + (label ? 1 : 0), humanizeKey(k)));
  });
  return out;
};

/* ======= CONFIG (mirrors JSX) ======= */
const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'screening-scores': 'Screening Scores',
  'social-support': 'Social Support',
  'substance-use': 'Substance Use Screening',
  'psychosocial-factors': 'Psychosocial Factors',
  'findings-assessment': 'Findings & Assessment',
  'plan-recommendations': 'Plan & Recommendations',
  results: 'Results',
  'notes-status': 'Notes & Status',
};
const SECTION_ORDER = ['assessment-info', 'screening-scores', 'social-support', 'substance-use', 'psychosocial-factors', 'findings-assessment', 'plan-recommendations', 'results', 'notes-status'];
const SECTION_FIELDS = {
  'assessment-info': ['provider', 'facility', 'date', 'type'],
  'screening-scores': ['edinburghScore', 'anxietyScreening', 'domesticViolenceScreen'],
  'social-support': ['socialSupport'],
  'substance-use': ['substanceUseScreen.alcohol', 'substanceUseScreen.tobacco', 'substanceUseScreen.drugs'],
  'psychosocial-factors': ['housingStability', 'financialConcerns', 'relationshipStress', 'previousPostpartumDepression'],
  'findings-assessment': ['findings', 'assessment'],
  'plan-recommendations': ['plan', 'recommendations'],
  results: ['results'],
  'notes-status': ['notes', 'status'],
};
const FIELD_LABELS = {
  provider: 'Provider',
  facility: 'Facility',
  date: 'Date',
  type: 'Type',
  edinburghScore: 'Edinburgh Score',
  anxietyScreening: 'Anxiety Screening',
  domesticViolenceScreen: 'Domestic Violence Screen',
  socialSupport: 'Social Support',
  'substanceUseScreen.alcohol': 'Alcohol',
  'substanceUseScreen.tobacco': 'Tobacco',
  'substanceUseScreen.drugs': 'Drugs',
  housingStability: 'Housing Stability',
  financialConcerns: 'Financial Concerns',
  relationshipStress: 'Relationship Stress',
  previousPostpartumDepression: 'Previous Postpartum Depression',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
  status: 'Status',
};
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['previousPostpartumDepression'];
const ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['results'];

/* dot-path resolver */
const getVal = (record, f) => {
  if (f.includes('.')) return f.split('.').reduce((o, k) => (o == null ? o : o[k]), record);
  return record[f];
};

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const labelEl = (f) => <Text key={`${f}-l`} style={styles.fieldLabel}>{FIELD_LABELS[f] || f}</Text>;

/* sentence field → bare label + sentence/comma value lines (mirrors JSX renderStringField display) */
const sentenceEls = (f, val, showLabel) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const parsedWhole = parseLabel(strVal);
  const singleLabeledList = sentences.length === 1 && parsedWhole.isLabeled && splitByComma(parsedWhole.value).length >= 2;
  const els = [];
  if (showLabel) els.push(labelEl(f));
  if (sentences.length <= 1 && !singleLabeledList) {
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

/* boolean field → bare label + Yes/No value */
const booleanEls = (f, val, showLabel) => {
  const els = [];
  if (showLabel) els.push(labelEl(f));
  els.push(<Text key={`${f}-v`} style={styles.value}>{val ? 'Yes' : 'No'}</Text>);
  return els;
};

/* date field → bare label + formatted date */
const dateEls = (f, val, showLabel) => {
  const els = [];
  if (showLabel) els.push(labelEl(f));
  els.push(<Text key={`${f}-v`} style={styles.value}>{formatDate(val)}</Text>);
  return els;
};

/* recommendations (array of {recommendation, date}) → label + one numbered line per item */
const recommendationsEls = (val, showLabel) => {
  const items = safeArray(val);
  if (items.length === 0) return [];
  const els = [];
  if (showLabel) els.push(labelEl('recommendations'));
  items.forEach((rec, ri) => {
    const t = (typeof rec === 'object') ? (rec.recommendation || `Recommendation ${ri + 1}`) : String(rec);
    const dt = (typeof rec === 'object' && rec.date) ? ` (${formatDate(rec.date)})` : '';
    els.push(<Text key={`rec-${ri}`} style={styles.listItem}>{`${ri + 1}. ${safeString(`${t}${dt}`)}`}</Text>);
  });
  return els;
};

/* results (dynamic-key object) → flattened humanized lines (section title serves as header) */
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
  const val = getVal(record, f);
  if (!hasVal(val)) return [];
  const sectionTitle = SECTION_TITLES[sid] || '';
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
  if (ARRAY_FIELDS.includes(f)) return recommendationsEls(val, showLabel);
  if (OBJECT_FIELDS.includes(f)) return resultsEls(val);
  if (DATE_FIELDS.includes(f)) return dateEls(f, val, showLabel);
  if (BOOLEAN_FIELDS.includes(f)) return booleanEls(f, val, showLabel);
  return sentenceEls(f, val, showLabel);
};

/* ======= COMPONENT ======= */
const PsychosocialAssessmentsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.psychosocial_assessments) return Array.isArray(r.psychosocial_assessments) ? r.psychosocial_assessments : [r.psychosocial_assessments];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychosocial_assessments) return Array.isArray(dd.psychosocial_assessments) ? dd.psychosocial_assessments : [dd.psychosocial_assessments]; if (dd?.records) return Array.isArray(dd.records) ? dd.records : [dd.records]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychosocial Assessments</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychosocial Assessments</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{safeString(record.type || `Psychosocial Assessment ${index + 1}`)}</Text>
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

export default PsychosocialAssessmentsDocumentPDFTemplate;
