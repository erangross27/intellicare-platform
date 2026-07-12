/**
 * ProceduralSedationDocumentPDFTemplate.jsx
 * Box-free B&W — LETTER size — procedural sedation
 * Collection: procedural_sedation
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordDate: { fontSize: 12, color: '#000000', marginBottom: 4 },
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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const humanizeKey = (key) => String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase()).trim();

/* ======= CONFIG (mirrors JSX) ======= */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'indication': 'Indication',
  'medications': 'Medications',
  'monitoring': 'Monitoring',
  'findings-assessment': 'Findings and Assessment',
  'complications-recovery': 'Complications and Recovery',
  'plan-recommendations': 'Plan and Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  provider: 'Provider',
  facility: 'Facility',
  type: 'Type',
  status: 'Status',
  indication: 'Indication',
  medications: 'Medications',
  monitoring: 'Monitoring',
  findings: 'Findings',
  assessment: 'Assessment',
  complications: 'Complications',
  recoveryTime: 'Recovery Time',
  notes: 'Notes',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
};

const SECTION_FIELDS = {
  'record-info': ['provider', 'facility', 'type', 'status'],
  'indication': ['indication'],
  'medications': ['medications'],
  'monitoring': ['monitoring'],
  'findings-assessment': ['findings', 'assessment'],
  'complications-recovery': ['complications', 'recoveryTime'],
  'plan-recommendations': ['plan', 'recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const SECTION_ORDER = ['record-info', 'indication', 'medications', 'monitoring', 'findings-assessment', 'complications-recovery', 'plan-recommendations', 'results', 'notes'];
const ARRAY_FIELDS = ['complications', 'recommendations'];
const OBJECT_FIELDS = ['medications', 'monitoring', 'results'];
const STRING_FIELDS = ['indication', 'provider', 'recoveryTime', 'type', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];

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

/* medicationsBody: array of medication objects → flat stacked Text (name sub-label + Dose/Route/Time stacked) */
const medicationsBody = (meds) => {
  const els = [];
  (Array.isArray(meds) ? meds : []).forEach((med, i) => {
    if (!med || typeof med !== 'object') { els.push(<Text style={styles.value}>{`${i + 1}. ${safeString(med)}`}</Text>); return; }
    els.push(<Text style={styles.subLabel}>{safeString(med.name || `Medication ${i + 1}`)}</Text>);
    [['dose', 'Dose'], ['route', 'Route'], ['time', 'Time']].forEach(([k, lab]) => {
      if (hasVal(med[k])) { els.push(<Text style={styles.subLabel}>{lab}</Text>); els.push(<Text style={styles.value}>{safeString(med[k])}</Text>); }
    });
  });
  return els;
};

/* monitoringBody: nested object with preVitals/intraVitals/postVitals → flat stacked Text */
const monitoringBody = (mon) => {
  const els = [];
  if (!mon || typeof mon !== 'object' || Array.isArray(mon)) return els;
  const kvGroup = (obj, heading) => {
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return;
    els.push(<Text style={styles.subLabel}>{heading}</Text>);
    Object.entries(obj).filter(([, v]) => hasVal(v)).forEach(([key, value]) => {
      const fk = String(key).replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
      els.push(<Text style={styles.subLabel}>{safeString(fk)}</Text>);
      els.push(<Text style={styles.value}>{safeString(value)}</Text>);
    });
  };
  kvGroup(mon.preVitals, 'Pre-Procedure Vitals');
  if (Array.isArray(mon.intraVitals) && mon.intraVitals.length > 0) {
    els.push(<Text style={styles.subLabel}>Intra-Procedure Monitoring</Text>);
    mon.intraVitals.filter(hasVal).forEach((item, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>));
  }
  kvGroup(mon.postVitals, 'Post-Procedure Vitals');
  return els;
};

/* objectBody: dynamic-key object (results), recursive, humanized keys + stacked leaves */
const objectBody = (obj) => {
  const els = [];
  const walk = (o) => {
    Object.entries(o).filter(([, v]) => hasVal(v)).forEach(([k, v]) => {
      const dispKey = humanizeKey(k);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        els.push(<Text style={styles.subLabel}>{safeString(dispKey)}</Text>);
        walk(v);
      } else if (Array.isArray(v)) {
        els.push(<Text style={styles.subLabel}>{safeString(dispKey)}</Text>);
        v.filter(hasVal).forEach((it, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${it && typeof it === 'object' && !Array.isArray(it) ? Object.entries(it).filter(([, vv]) => hasVal(vv)).map(([kk, vv]) => `${humanizeKey(kk)}: ${safeString(fmtVal(vv))}`).join(', ') : safeString(it)}`}</Text>));
      } else {
        els.push(<Text style={styles.subLabel}>{safeString(dispKey)}</Text>);
        els.push(<Text style={styles.value}>{safeString(fmtVal(v))}</Text>);
      }
    });
  };
  walk(obj);
  return els;
};

/* fieldBody: FLAT array of small Text elements for one field */
const fieldBody = (record, sid, f) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = !sameAsTitle(label, sid);
  const els = [];
  if (f === 'medications') return medicationsBody(val);
  if (f === 'monitoring') return monitoringBody(val);
  if (OBJECT_FIELDS.includes(f)) return objectBody(val);
  if (ARRAY_FIELDS.includes(f)) {
    if (showLabel) els.push(<Text style={styles.fieldLabel}>{safeString(label)}</Text>);
    (Array.isArray(val) ? val : [val]).filter(hasVal).forEach((item, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${item && typeof item === 'object' && !Array.isArray(item) ? Object.entries(item).filter(([, v]) => hasVal(v)).map(([k, v]) => `${humanizeKey(k)}: ${safeString(fmtVal(v))}`).join(', ') : safeString(item)}`}</Text>));
    return els;
  }
  if (STRING_FIELDS.includes(f)) {
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    if (showLabel) els.push(<Text style={styles.fieldLabel}>{safeString(label)}</Text>);
    if (sentences.length > 1 || parseLabel(strVal).isLabeled) {
      formatSentenceLines(strVal).forEach(row => {
        if (row.type === 'sub') els.push(<Text style={styles.subLabel}>{safeString(row.text)}</Text>);
        else els.push(<Text style={styles.listItem}>{`${row.num}. ${safeString(row.text)}`}</Text>);
      });
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
const ProceduralSedationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.procedural_sedation) return Array.isArray(r.procedural_sedation) ? r.procedural_sedation : [r.procedural_sedation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.procedural_sedation) return Array.isArray(dd.procedural_sedation) ? dd.procedural_sedation : [dd.procedural_sedation]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Procedural Sedation</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Procedural Sedation</Text>
        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
            <Text style={styles.recordTitle}>{`Procedural Sedation ${index + 1}`}</Text>
            {SECTION_ORDER.map((sid, sIdx) => renderSection(record, sid, sIdx))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ProceduralSedationDocumentPDFTemplate;
