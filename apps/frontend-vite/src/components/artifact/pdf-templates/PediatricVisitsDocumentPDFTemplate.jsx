/**
 * PediatricVisitsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) -- mirrors PediatricVisitsDocument.jsx.
 * Config-driven SECTION_ORDER. Static-field sections (visit-info / immunization / physical-exam /
 * assessment / plan / anticipatory-guidance) resolve dotted paths via resolvePath. Dynamic-key
 * object sections (developmentalMilestones / growthParameters) render one wrap={false} unit PER KEY
 * (array subfields numbered, {value,percentile} measurement objects flattened to a single line via
 * growthMeasurementText, other objects via objectRows). Narrative strings (chiefComplaint /
 * physicalExamination / assessment / plan) use [.;] sentence-split (abbrev + single-initial + digit
 * guards, leading "N." list-marker stripped, labeled -> subLabel + value, thousands-guarded comma).
 * Single-name label gate (a field label == its section title -> label hidden). Rule #74: every field
 * is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's View.
 * safeString uses \uXXXX escapes only. Static PHI footer. Collection: pediatric_visits.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 12 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
});

/* ======= CONFIG (mirrors the JSX) ======= */
const SECTION_ORDER = [
  'visit-info', 'developmental-milestones', 'immunization-status', 'growth-parameters',
  'physical-examination', 'assessment', 'plan', 'anticipatory-guidance',
];

const SECTION_TITLES = {
  'visit-info': 'Visit Information',
  'developmental-milestones': 'Developmental Milestones',
  'immunization-status': 'Immunization Status',
  'growth-parameters': 'Growth Parameters',
  'physical-examination': 'Physical Examination',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'anticipatory-guidance': 'Anticipatory Guidance',
};

const FIELD_LABELS = {
  visitDate: 'Visit Date',
  age: 'Age',
  chiefComplaint: 'Chief Complaint',
  immunizationStatus: 'Immunization Status',
  physicalExamination: 'Physical Examination',
  assessment: 'Assessment',
  plan: 'Plan',
  anticipatoryGuidance: 'Anticipatory Guidance',
};

/* Static-field sections (dotted paths resolved with resolvePath). */
const SECTION_FIELDS = {
  'visit-info': ['visitDate', 'age', 'chiefComplaint'],
  'immunization-status': ['immunizationStatus'],
  'physical-examination': ['physicalExamination'],
  'assessment': ['assessment'],
  'plan': ['plan'],
  'anticipatory-guidance': ['anticipatoryGuidance'],
};

/* Dynamic-key object sections -> one wrap={false} unit per present key. */
const SECTION_OBJECT_KEYS = {
  'developmental-milestones': 'developmentalMilestones',
  'growth-parameters': 'growthParameters',
};

const DATE_FIELDS = ['visitDate'];
const ARRAY_FIELDS = ['immunizationStatus', 'anticipatoryGuidance'];

const MILESTONE_LABELS = { grossMotor: 'Gross Motor', fineMotor: 'Fine Motor', language: 'Language', socialEmotional: 'Social/Emotional', cognitive: 'Cognitive' };
const GROWTH_LABELS = { height: 'Height', weight: 'Weight', bmi: 'BMI' };
const OBJECT_KEY_ORDER = { developmentalMilestones: ['grossMotor', 'fineMotor', 'language', 'socialEmotional', 'cognitive'], growthParameters: ['height', 'weight', 'bmi'] };

/* ======= HELPERS ======= */
const resolvePath = (obj, p) => { if (!obj || !p) return undefined; return p.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj); };

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

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* growthMeasurementText: flatten a growth subfield ({value, percentile} OR string) to one line. */
const growthMeasurementText = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && !Array.isArray(val)) {
    const v = val.value !== undefined && val.value !== null ? String(val.value) : '';
    const p = val.percentile !== undefined && val.percentile !== null && val.percentile !== '' ? String(val.percentile) : '';
    if (v && p) return `${v} - ${p} percentile`;
    return v || (p ? `${p} percentile` : '');
  }
  return String(val);
};

/* safeString: \uXXXX escapes ONLY -- never paste literal smart-quotes / dashes / invisible chars. */
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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]|\d))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* Recursively flatten a nested object into box-free rows (scalars inline "Key: value"). */
const objectRows = (obj, kp) => {
  const out = [];
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const key = `${kp}.${k}.${i}`;
    if (isScalar(v)) {
      out.push(<Text key={key} style={styles.value}>{safeString(humanizeKey(k))}: {safeString(fmtScalar(v))}</Text>);
    } else if (Array.isArray(v)) {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach((it, j) => {
        if (isScalar(it)) out.push(<Text key={key + '-' + j} style={styles.value}>{j + 1}. {safeString(fmtScalar(it))}</Text>);
        else objectRows(it, key + '-' + j).forEach(r => out.push(r));
      });
    } else {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      objectRows(v, key).forEach(r => out.push(r));
    }
  });
  return out;
};

/* Top-level value -> rows for one static field. */
const fieldBody = (field, val) => {
  if (DATE_FIELDS.includes(field)) return [<Text key="d" style={styles.value}>{safeString(formatDate(val))}</Text>];
  if (ARRAY_FIELDS.includes(field) || Array.isArray(val)) {
    const items = (Array.isArray(val) ? val : [val]).filter(hasVal);
    const out = [];
    items.forEach((it, i) => {
      if (isScalar(it)) out.push(<Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>);
      else objectRows(it, 'a' + i).forEach(r => out.push(r));
    });
    return out;
  }
  if (val && typeof val === 'object') return objectRows(val, field);
  if (typeof val === 'string') {
    const rows = sentenceRows(val);
    if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(val)}</Text>];
    return rows.map((r, i) => r.type === 'sub'
      ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
      : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
  }
  return [<Text key="v" style={styles.value}>{safeString(fmtScalar(val))}</Text>];
};

/* Dynamic-key object value -> rows for one key (array numbered, measurement object one line). */
const keyBody = (objKey, val) => {
  const out = [];
  if (Array.isArray(val)) {
    val.filter(hasVal).forEach((it, i) => {
      if (isScalar(it)) out.push(<Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>);
      else objectRows(it, objKey + i).forEach(r => out.push(r));
    });
  } else if (val && typeof val === 'object') {
    if (val.value !== undefined) out.push(<Text key="m" style={styles.value}>{safeString(growthMeasurementText(val))}</Text>);
    else objectRows(val, objKey).forEach(r => out.push(r));
  } else if (typeof val === 'string') {
    const rows = sentenceRows(val);
    if (rows.length === 0) out.push(<Text key="v" style={styles.value}>{safeString(val)}</Text>);
    else rows.forEach((r, i) => out.push(r.type === 'sub'
      ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
      : <Text key={i} style={styles.value}>{strip(r.text)}</Text>));
  } else {
    out.push(<Text key="v" style={styles.value}>{safeString(fmtScalar(val))}</Text>);
  }
  return out;
};

const objectKeyLabel = (objKey, key) => {
  if (objKey === 'developmentalMilestones') return MILESTONE_LABELS[key] || humanizeKey(key);
  if (objKey === 'growthParameters') return GROWTH_LABELS[key] || humanizeKey(key);
  return humanizeKey(key);
};

const fieldPresent = (record, field) => hasVal(resolvePath(record, field));

const renderField = (record, field, sectionTitle, isFirst) => {
  const val = resolvePath(record, field);
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  return (
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {isFirst && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {fieldBody(field, val)}
    </View>
  );
};

/* Dynamic-key object section: one wrap={false} unit per present key; sectionTitle rides the first. */
const renderObjectSection = (record, sid, objKey) => {
  const obj = record[objKey];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const order = OBJECT_KEY_ORDER[objKey] || [];
  const keys = [...order.filter(k => k in obj), ...Object.keys(obj).filter(k => !order.includes(k))];
  const present = keys.filter(k => hasVal(obj[k]));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return (
    <View key={sid} style={styles.section}>
      {present.map((k, i) => {
        const label = objectKeyLabel(objKey, k);
        const showLabel = label.trim().toLowerCase() !== (title || '').trim().toLowerCase();
        return (
          <View key={k} style={styles.fieldGroup} wrap={false}>
            {i === 0 && <Text style={styles.sectionTitle}>{safeString(title)}</Text>}
            {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
            {keyBody(objKey, obj[k])}
          </View>
        );
      })}
    </View>
  );
};

const renderSection = (record, sid) => {
  const objKey = SECTION_OBJECT_KEYS[sid];
  if (objKey) return renderObjectSection(record, sid, objKey);
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return (
    <View key={sid} style={styles.section}>
      {present.map((f, i) => renderField(record, f, title, i === 0))}
    </View>
  );
};

const PediatricVisitsDocumentPDFTemplate = ({ document: docProp, data: dataProp }) => {
  const data = docProp || dataProp;
  let rawRecords = [];
  if (Array.isArray(data)) {
    rawRecords = data.flatMap(item => {
      if (item?.pediatric_visits) return Array.isArray(item.pediatric_visits) ? item.pediatric_visits : [item.pediatric_visits];
      if (item?.documentData) { const dd = item.documentData; if (Array.isArray(dd)) return dd; if (dd?.pediatric_visits) return Array.isArray(dd.pediatric_visits) ? dd.pediatric_visits : [dd.pediatric_visits]; return [dd]; }
      return [item];
    });
  } else if (data?.pediatric_visits) {
    rawRecords = Array.isArray(data.pediatric_visits) ? data.pediatric_visits : [data.pediatric_visits];
  } else if (data?.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) rawRecords = dd;
    else if (dd?.pediatric_visits) rawRecords = Array.isArray(dd.pediatric_visits) ? dd.pediatric_visits : [dd.pediatric_visits];
    else if (dd && typeof dd === 'object') rawRecords = [dd];
  } else if (data) {
    rawRecords = [data];
  }
  const records = rawRecords.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Pediatric Visits</Text></View>
          <Text style={styles.emptyState}>No pediatric visit records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Pediatric Visits</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{safeString(`Pediatric Visit ${idx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PediatricVisitsDocumentPDFTemplate;
