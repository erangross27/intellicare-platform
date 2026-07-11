import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * OperativeReportsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * surgeryDate renders as a normal FIELD (no top-level record date). operativeTime = nested object
 * -> objectRows (subLabel key + value); cptCodes = scalar array -> arrayRows (one value row each).
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
const SECTION_ORDER = ['surgery-info', 'surgical-team', 'surgical-technique', 'findings-complications', 'specimens-section', 'blood-loss-fluids', 'post-op'];

const SECTION_TITLES = {
  'surgery-info': 'Surgery Information',
  'surgical-team': 'Surgical Team',
  'surgical-technique': 'Surgical Technique',
  'findings-complications': 'Findings & Complications',
  'specimens-section': 'Specimens',
  'blood-loss-fluids': 'Blood Loss & Fluids',
  'post-op': 'Post-Op & Disposition',
};

const FIELD_LABELS = {
  procedureName: 'Procedure Name',
  surgeryDate: 'Surgery Date',
  operativeTime: 'Operative Time',
  cptCodes: 'CPT Codes',
  operatingRoom: 'Operating Room',
  facility: 'Facility',
  surgeon: 'Surgeon',
  assistantSurgeon: 'Assistant Surgeon',
  anesthesiologist: 'Anesthesiologist',
  anesthesiaType: 'Anesthesia Type',
  surgicalApproach: 'Surgical Approach',
  incisionLocation: 'Incision Location',
  closureTechnique: 'Closure Technique',
  dressings: 'Dressings',
  intraoperativeFindings: 'Intraoperative Findings',
  complications: 'Complications',
  specimens: 'Specimens',
  estimatedBloodLoss: 'Estimated Blood Loss',
  fluidsGiven: 'Fluids Given',
  implants: 'Implants',
  drains: 'Drains',
  postOpOrders: 'Post-Op Orders',
  disposition: 'Disposition',
};

const SECTION_FIELDS = {
  'surgery-info': ['procedureName', 'surgeryDate', 'operativeTime', 'cptCodes', 'operatingRoom', 'facility'],
  'surgical-team': ['surgeon', 'assistantSurgeon', 'anesthesiologist', 'anesthesiaType'],
  'surgical-technique': ['surgicalApproach', 'incisionLocation', 'closureTechnique', 'dressings'],
  'findings-complications': ['intraoperativeFindings', 'complications'],
  'specimens-section': ['specimens'],
  'blood-loss-fluids': ['estimatedBloodLoss', 'fluidsGiven'],
  'post-op': ['implants', 'drains', 'postOpOrders', 'disposition'],
};

const NUMBER_FIELDS = [];
const DATE_FIELDS = ['surgeryDate'];
const OBJECT_FIELDS = ['operativeTime'];
const ARRAY_FIELDS = ['cptCodes'];

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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const humanizeKey = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());

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

/* objectRows: generic recursion for a nested object (operativeTime) -> subLabel (humanized key) + value.
   Recurses into nested objects and flattens arrays into value rows. */
const objectRows = (obj, keyPrefix = 'o') => {
  const out = [];
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (!hasVal(v)) return;
    const kk = `${keyPrefix}-${k}`;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(<Text key={`${kk}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      objectRows(v, kk).forEach(el => out.push(el));
    } else if (Array.isArray(v)) {
      out.push(<Text key={`${kk}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      v.forEach((it, i) => out.push(<Text key={`${kk}-${i}`} style={styles.value}>{safeString(fmtVal(it))}</Text>));
    } else {
      out.push(<Text key={`${kk}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      out.push(<Text key={`${kk}-v`} style={styles.value}>{safeString(fmtVal(v))}</Text>);
    }
  });
  return out;
};

/* arrayRows: scalar array (cptCodes) -> one value row per item */
const arrayRows = (arr) => {
  const items = (Array.isArray(arr) ? arr : []).map(x => safeString(fmtVal(x))).filter(s => s.trim() !== '');
  return items.map((it, i) => <Text key={i} style={styles.value}>{it}</Text>);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (OBJECT_FIELDS.includes(f)) return objectRows(v);
  if (ARRAY_FIELDS.includes(f)) return arrayRows(v);
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return present.map((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    return (
      <View key={f} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {fieldBody(record, f)}
      </View>
    );
  });
};

const OperativeReportsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.operative_reports) records = Array.isArray(data[0].operative_reports) ? data[0].operative_reports : [data[0].operative_reports];
    else records = data;
  } else if (data?.operative_reports) records = Array.isArray(data.operative_reports) ? data.operative_reports : [data.operative_reports];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Operative Reports</Text>
          <Text style={styles.noData}>No operative reports available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Operative Reports</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Operative Report ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default OperativeReportsDocumentPDFTemplate;
