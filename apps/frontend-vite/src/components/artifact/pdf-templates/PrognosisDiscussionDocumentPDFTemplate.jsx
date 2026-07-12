import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ═══════ BOX-FREE PDF — Helvetica LETTER, black on white, underlined bare labels ═══════ */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', marginBottom: 14 },
  recordCard: { marginBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', marginTop: 6, marginBottom: 10 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', marginTop: 8, marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', marginTop: 6, marginBottom: 2 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 14, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 2 },
});

/* ═══════ CONFIG (mirrors PrognosisDiscussionDocument.jsx) ═══════ */
const SECTION_TITLES = {
  'discussion-info': 'Discussion Information',
  'patient-response': 'Patient Response',
  'support-system': 'Support System',
  'counseling': 'Counseling',
  'findings': 'Findings',
  'assessment-plan': 'Assessment and Plan',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'financial-concerns': 'Financial Concerns',
  'monitoring-notes': 'Monitoring and Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  patientUnderstandingButAnxious: 'Patient Understanding',
  patientTearful: 'Patient Tearful',
  familySupport: 'Family Support',
  brotherVerySupportive: 'Brother Very Supportive',
  providedEmotionalSupportAndResources: 'Emotional Support Provided',
  emphasizedProgressionCanBeSlowed: 'Progression Can Be Slowed',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  recommendations: 'Recommendations',
  financialConcernsSignificant: 'Financial Concerns',
  willNeedCloseMonitoring: 'Follow-Up Monitoring',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'discussion-info': ['date', 'provider', 'facility', 'status'],
  'patient-response': ['patientUnderstandingButAnxious', 'patientTearful'],
  'support-system': ['familySupport', 'brotherVerySupportive', 'providedEmotionalSupportAndResources'],
  'counseling': ['emphasizedProgressionCanBeSlowed'],
  'findings': ['findings'],
  'assessment-plan': ['assessment', 'plan'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'financial-concerns': ['financialConcernsSignificant'],
  'monitoring-notes': ['willNeedCloseMonitoring', 'notes'],
};

const BOOLEAN_FIELDS = ['patientTearful', 'providedEmotionalSupportAndResources', 'emphasizedProgressionCanBeSlowed'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['results'];
const COMMA_SPLIT_FIELDS = ['willNeedCloseMonitoring'];

/* ═══════ HELPERS ═══════ */
const safeString = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
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

const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

const flattenItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && !Array.isArray(item)) {
    const main = item.recommendation || item.text || item.value || '';
    const d = item.date ? ` (${formatDate(item.date)})` : '';
    if (main) return `${main}${d}`;
    return Object.entries(item).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => `${humanizeKey(k)}: ${v}`).join(', ');
  }
  return String(item);
};

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

/* formatSentenceLines: mirrors JSX formatSentenceFieldLines (labeled sub-label + numbered comma items / numbered sentences) */
const formatSentenceLines = (text) => {
  const sentences = splitBySentence(text);
  const out = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        out.push({ sub: parsed.label });
        parts.forEach(item => out.push({ item: `${n++}. ${item}` }));
      } else { out.push({ sub: parsed.label }); out.push({ item: `${n++}. ${parsed.value}` }); }
    } else { out.push({ item: `${n++}. ${s}` }); }
  });
  return out;
};

const fieldHasVal = (fn, val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return Number.isFinite(val);
  if (typeof val === 'string') return val.trim() !== '';
  if (Array.isArray(val)) return val.filter(x => !isEmptyDeep(x)).length > 0;
  if (typeof val === 'object') return Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).length > 0;
  return true;
};

/* fieldBody: return a FLAT array of Text elements for one field (bare label + body rows) */
const fieldBody = (fn, val, sid) => {
  const label = FIELD_LABELS[fn] || fn;
  const els = [];
  if (!sameAsTitle(label, sid)) els.push(<Text style={styles.fieldLabel}>{safeString(label)}</Text>);

  if (DATE_FIELDS.includes(fn)) {
    els.push(<Text style={styles.value}>{safeString(formatDate(val))}</Text>);
  } else if (BOOLEAN_FIELDS.includes(fn)) {
    els.push(<Text style={styles.value}>{val ? 'Yes' : 'No'}</Text>);
  } else if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x)).map(flattenItem).filter(s => s && s.trim());
    items.forEach((item, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>));
  } else if (OBJECT_FIELDS.includes(fn)) {
    Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
      els.push(<Text style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(fmtScalar(v))}`}</Text>);
    });
  } else if (COMMA_SPLIT_FIELDS.includes(fn) && splitBySentence(fmtScalar(val)).length <= 1 && !parseLabel(fmtScalar(val)).isLabeled && splitByComma(fmtScalar(val)).length >= 2) {
    splitByComma(fmtScalar(val)).forEach((p, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(p)}`}</Text>));
  } else {
    const strVal = fmtScalar(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1 || parseLabel(strVal).isLabeled) {
      formatSentenceLines(strVal).forEach(line => {
        if (line.sub !== undefined) els.push(<Text style={styles.subLabel}>{safeString(line.sub)}</Text>);
        else els.push(<Text style={styles.listItem}>{safeString(line.item)}</Text>);
      });
    } else {
      els.push(<Text style={styles.value}>{safeString(strVal)}</Text>);
    }
  }
  return els;
};

/* renderSection: FLATTEN — glue sectionTitle + first body element in a wrap={false} View, rest flow (anti-orphan) */
const renderSection = (record, sid, ridx) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const bodyEls = [];
  fields.forEach(fn => { const val = record[fn]; if (fieldHasVal(fn, val)) fieldBody(fn, val, sid).forEach(el => bodyEls.push(el)); });
  if (bodyEls.length === 0) return null;

  const first = bodyEls[0];
  const rest = bodyEls.slice(1);
  return (
    <View key={`${sid}-${ridx}`} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {React.cloneElement(first, { key: 'f0' })}
      </View>
      {rest.map((el, i) => React.cloneElement(el, { key: `f${i + 1}` }))}
    </View>
  );
};

/* ═══════ DATA UNWRAP ═══════ */
const unwrapData = (rawData) => {
  if (!rawData) return [];
  let arr = Array.isArray(rawData) ? rawData : [rawData];
  arr = arr.flatMap(r => {
    if (r?.prognosis_discussion) return Array.isArray(r.prognosis_discussion) ? r.prognosis_discussion : [r.prognosis_discussion];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.prognosis_discussion) return Array.isArray(dd.prognosis_discussion) ? dd.prognosis_discussion : [dd.prognosis_discussion]; return [dd]; }
    if (r?._records && Array.isArray(r._records)) return r._records;
    if (r?.records && Array.isArray(r.records)) return r.records;
    return [r];
  });
  return arr.filter(r => r && typeof r === 'object');
};

const PrognosisDiscussionDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Prognosis Discussion</Text>
          <Text style={styles.value}>No prognosis discussion data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Prognosis Discussion</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard} break={idx > 0}>
            <Text style={styles.recordTitle}>Prognosis Discussion {idx + 1}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid, idx))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrognosisDiscussionDocumentPDFTemplate;
