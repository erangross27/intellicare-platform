import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * OperativeDetailsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * String arrays -> value rows (labeled items decompose into a subLabel + value, never side-by-side).
 * perioperativeProtocol.* dot-path fields are derived dynamically from the record object.
 * Record date is surgeryDate (rendered as a field) - NEVER createdAt/updatedAt.
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
const SECTION_ORDER = ['operation-info', 'surgical-team', 'diagnosis', 'procedures', 'perioperative-protocol', 'surgical-plan', 'recommendations'];

const SECTION_TITLES = {
  'operation-info': 'Operation Information',
  'surgical-team': 'Surgical Team',
  'diagnosis': 'Diagnosis',
  'procedures': 'Procedures',
  'perioperative-protocol': 'Perioperative Protocol',
  'surgical-plan': 'Surgical Plan',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  surgeryDate: 'Surgery Date',
  facility: 'Facility',
  provider: 'Provider',
  urgency: 'Urgency',
  status: 'Status',
  scheduledTiming: 'Scheduled Timing',
  estimatedDuration: 'Estimated Duration',
  totalDuration: 'Total Duration',
  startTime: 'Start Time',
  endTime: 'End Time',
  laterality: 'Laterality',
  hospitalStay: 'Hospital Stay',
  surgeonName: 'Lead Surgeon',
  assistantSurgeons: 'Assistant Surgeons',
  anesthesiologist: 'Anesthesiologist',
  microsurgicalTeam: 'Microsurgical Team',
  preoperativeDiagnosis: 'Preoperative Diagnosis',
  postoperativeDiagnosis: 'Postoperative Diagnosis',
  proceduresPerformed: 'Procedures Performed',
  indication: 'Indication',
  plan: 'Plan',
  findings: 'Findings',
  assessment: 'Assessment',
  notes: 'Notes',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'operation-info': ['surgeryDate', 'facility', 'provider', 'urgency', 'status', 'scheduledTiming', 'estimatedDuration', 'totalDuration', 'startTime', 'endTime', 'laterality', 'hospitalStay'],
  'surgical-team': ['surgeonName', 'assistantSurgeons', 'anesthesiologist', 'microsurgicalTeam'],
  'diagnosis': ['preoperativeDiagnosis', 'postoperativeDiagnosis'],
  'procedures': ['proceduresPerformed', 'indication'],
  'perioperative-protocol': [],
  'surgical-plan': ['plan', 'findings', 'assessment', 'notes'],
  'recommendations': ['recommendations'],
};

const DATE_FIELDS = ['surgeryDate'];
const ARRAY_FIELDS = ['assistantSurgeons', 'microsurgicalTeam', 'preoperativeDiagnosis', 'postoperativeDiagnosis', 'proceduresPerformed', 'recommendations'];

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

/* Known perioperativeProtocol subkeys -> labels; unknown keys humanized */
const PROTOCOL_LABELS = {
  preoperativeOptimization: 'Preoperative Optimization',
  icuMonitoring: 'ICU Monitoring',
  dvtProphylaxis: 'DVT Prophylaxis',
};
const humanizeKey = (key) => {
  if (!key || typeof key !== 'string') return String(key || '');
  return key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
};

const resolvePath = (record, key) => {
  if (!key.includes('.')) return record[key];
  return key.split('.').reduce((v, p) => (v == null ? undefined : v[p]), record);
};

/* protocolFields: derive perioperativeProtocol dot-path fields from the ACTUAL object so dynamic keys render */
const protocolFields = (record) => {
  const obj = record && record.perioperativeProtocol;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const known = ['preoperativeOptimization', 'icuMonitoring', 'dvtProphylaxis'];
  const ordered = [...known.filter(k => k in obj), ...Object.keys(obj).filter(k => !known.includes(k))];
  return ordered.map(k => ({ key: `perioperativeProtocol.${k}`, label: PROTOCOL_LABELS[k] || humanizeKey(k) }));
};

const sectionFields = (record, sid) => {
  if (sid === 'perioperative-protocol') return protocolFields(record);
  return (SECTION_FIELDS[sid] || []).map(k => ({ key: k, label: FIELD_LABELS[k] || k }));
};

const fieldPresent = (record, key) => hasVal(resolvePath(record, key));

/* String-or-object arrays: each item -> value row (labeled items decompose into subLabel + value) */
const arrayRows = (val) => {
  const items = (Array.isArray(val) ? val : []).filter(Boolean).map(it => (typeof it === 'object' ? (it.recommendation || JSON.stringify(it)) : String(it)));
  const rows = [];
  items.forEach((itemStr, i) => {
    const p = parseLabel(itemStr);
    if (p.isLabeled) {
      rows.push(<Text key={`s${i}`} style={styles.subLabel}>{safeString(p.label)}</Text>);
      rows.push(<Text key={`v${i}`} style={styles.value}>{strip(p.value)}</Text>);
    } else {
      rows.push(<Text key={`v${i}`} style={styles.value}>{strip(itemStr)}</Text>);
    }
  });
  return rows;
};

const fieldBody = (record, key) => {
  const v = resolvePath(record, key);
  if (DATE_FIELDS.includes(key)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (ARRAY_FIELDS.includes(key) || Array.isArray(v)) return arrayRows(v);
  if (typeof v === 'boolean') return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = sectionFields(record, sid);
  const present = fields.filter(f => fieldPresent(record, f.key));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return present.map((f, i) => {
    const showLabel = (f.label || '').trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    return (
      <View key={f.key} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(f.label)}</Text>}
        {fieldBody(record, f.key)}
      </View>
    );
  });
};

const OperativeDetailsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.operative_details) records = Array.isArray(data[0].operative_details) ? data[0].operative_details : [data[0].operative_details];
    else records = data;
  } else if (data?.operative_details) records = Array.isArray(data.operative_details) ? data.operative_details : [data.operative_details];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Operative Details</Text>
          <Text style={styles.noData}>No operative details records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Operative Details</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Operative Details ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default OperativeDetailsDocumentPDFTemplate;
