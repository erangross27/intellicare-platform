/**
 * ProceduresInterventionsDocumentPDFTemplate.jsx
 * Box-free B&W — LETTER size — procedures interventions
 * Collection: procedures_interventions
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 6, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 10 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
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

const safeString = (val) => {
  let s;
  if (val === null || val === undefined) s = '';
  else if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
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

/* ======= CONFIG (mirrors JSX) ======= */
const SECTION_TITLES = {
  'timing': 'Timing',
  'clinical-status': 'Clinical Status',
  'vital-signs': 'Vital Signs',
  'interventions': 'Interventions',
  'response': 'Response',
  'plan-recommendations': 'Plan and Recommendations',
};

const FIELD_LABELS = {
  assessmentDate: 'Assessment Date',
  assessmentTime: 'Assessment Time',
  clinicalStatus: 'Clinical Status',
  vitalSigns: 'Vital Signs',
  interventions: 'Interventions',
  response: 'Response',
  plan: 'Plan',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'timing': ['assessmentDate', 'assessmentTime'],
  'clinical-status': ['clinicalStatus'],
  'vital-signs': ['vitalSigns'],
  'interventions': ['interventions'],
  'response': ['response'],
  'plan-recommendations': ['plan', 'recommendations'],
};

const SECTION_ORDER = ['timing', 'clinical-status', 'vital-signs', 'interventions', 'response', 'plan-recommendations'];
const DATE_FIELDS = ['assessmentDate'];
const ARRAY_FIELDS = ['recommendations'];
const STRING_FIELDS = ['assessmentTime', 'clinicalStatus', 'vitalSigns', 'interventions', 'response', 'plan'];
const COMMA_SPLIT_FIELDS = ['vitalSigns', 'response'];

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

/* formatSentenceLines: mirror JSX formatSentenceFieldLines (labeled sub + comma-split, else numbered) */
const formatSentenceLines = (text) => {
  const sentences = splitBySentence(fmtVal(text));
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        rows.push({ type: 'sub', text: parsed.label });
        parts.forEach(item => rows.push({ type: 'item', text: item, num: n++ }));
      } else {
        rows.push({ type: 'sub', text: parsed.label });
        rows.push({ type: 'item', text: parsed.value, num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: s, num: n++ });
    }
  });
  return rows;
};

/* fieldBody: FLAT array of small Text elements for one field */
const fieldBody = (record, sid, f) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = !sameAsTitle(label, sid);
  const els = [];
  if (DATE_FIELDS.includes(f)) {
    if (showLabel) els.push(<Text style={styles.fieldLabel}>{safeString(label)}</Text>);
    els.push(<Text style={styles.value}>{formatDate(val)}</Text>);
    return els;
  }
  if (ARRAY_FIELDS.includes(f)) {
    if (showLabel) els.push(<Text style={styles.fieldLabel}>{safeString(label)}</Text>);
    (Array.isArray(val) ? val : [val]).filter(hasVal).forEach((item, i) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const recText = item.recommendation || '';
        const recDate = item.date ? formatDate(item.date) : '';
        els.push(<Text style={styles.listItem}>{`${i + 1}. ${recDate ? `[${recDate}] ` : ''}${safeString(recText)}`}</Text>);
      } else {
        els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>);
      }
    });
    return els;
  }
  if (STRING_FIELDS.includes(f)) {
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const commaParts = splitByComma(strVal);
    if (showLabel) els.push(<Text style={styles.fieldLabel}>{safeString(label)}</Text>);
    if (sentences.length > 1) {
      formatSentenceLines(strVal).forEach(row => {
        if (row.type === 'sub') els.push(<Text style={styles.subLabel}>{safeString(row.text)}</Text>);
        else els.push(<Text style={styles.listItem}>{`${row.num}. ${safeString(row.text)}`}</Text>);
      });
    } else if (COMMA_SPLIT_FIELDS.includes(f) && !parseLabel(strVal).isLabeled && commaParts.length >= 2) {
      commaParts.forEach((p, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(p)}`}</Text>));
    } else {
      els.push(<Text style={styles.value}>{safeString(strVal)}</Text>);
    }
    return els;
  }
  if (showLabel) els.push(<Text style={styles.fieldLabel}>{safeString(label)}</Text>);
  els.push(<Text style={styles.value}>{safeString(fmtVal(val))}</Text>);
  return els;
};

/* renderSection: FLATTEN anti-orphan — glue sectionTitle + first element, rest flow */
const renderSection = (record, sid, sIdx) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const allEls = [];
  fields.forEach(f => {
    fieldBody(record, sid, f).forEach((el, i) => {
      allEls.push(React.cloneElement(el, { key: `${f}-${i}` }));
    });
  });
  if (allEls.length === 0) return null;
  const [first, ...rest] = allEls;
  return (
    <View key={sIdx} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

/* ======= COMPONENT ======= */
const ProceduresInterventionsDocumentPDFTemplate = ({ document: docProp }) => {
  const records = React.useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.procedures_interventions) return Array.isArray(r.procedures_interventions) ? r.procedures_interventions : [r.procedures_interventions];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.procedures_interventions) return Array.isArray(dd.procedures_interventions) ? dd.procedures_interventions : [dd.procedures_interventions]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Procedures and Interventions</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Procedures and Interventions</Text>
        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <Text style={styles.recordTitle}>{`Procedure/Intervention ${index + 1}`}</Text>
            {SECTION_ORDER.map((sid, sIdx) => renderSection(record, sid, sIdx))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ProceduresInterventionsDocumentPDFTemplate;
