import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MedicalHistoryDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (hasVal + hide-zero) for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Record date = record.date (the SAME date the JSX edits) - NEVER createdAt/updatedAt.
 * socialHistory (OBJECT) -> recursive objectRows: each key becomes a subLabel + value (never side-by-side).
 * Array-of-strings fields -> one value row per item.
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
const SECTION_ORDER = [
  'provider-details', 'chief-complaint', 'chronic-conditions', 'past-surgeries',
  'allergies', 'current-medications', 'immunization-history', 'social-history', 'travel-history',
];

const SECTION_TITLES = {
  'provider-details': 'Provider Details',
  'chief-complaint': 'Chief Complaint',
  'chronic-conditions': 'Chronic Conditions',
  'past-surgeries': 'Past Surgeries',
  'allergies': 'Allergies',
  'current-medications': 'Current Medications',
  'immunization-history': 'Immunization History',
  'social-history': 'Social History',
  'travel-history': 'Travel History',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  chiefComplaint: 'Chief Complaint',
  chronicConditions: 'Chronic Conditions',
  pastSurgeries: 'Past Surgeries',
  allergies: 'Allergies',
  currentMedications: 'Current Medications',
  immunizationHistory: 'Immunization History',
  socialHistory: 'Social History',
  travelHistory: 'Travel History',
  occupation: 'Occupation',
  travelCompanion: 'Travel Companion',
  livingSituation: 'Living Situation',
  maritalStatus: 'Marital Status',
  tobacco: 'Tobacco',
  alcohol: 'Alcohol',
  drugs: 'Drugs',
  children: 'Children',
  supportSystem: 'Support System',
};

const SECTION_FIELDS = {
  'provider-details': ['date', 'provider', 'facility'],
  'chief-complaint': ['chiefComplaint'],
  'chronic-conditions': ['chronicConditions'],
  'past-surgeries': ['pastSurgeries'],
  'allergies': ['allergies'],
  'current-medications': ['currentMedications'],
  'immunization-history': ['immunizationHistory'],
  'social-history': ['socialHistory'],
  'travel-history': ['travelHistory'],
};

const NUMBER_FIELDS = [];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['chronicConditions', 'pastSurgeries', 'allergies', 'currentMedications', 'immunizationHistory', 'travelHistory'];
const OBJECT_FIELDS = ['socialHistory'];

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

const prettifyKey = (k) => {
  const s = String(k || '');
  if (FIELD_LABELS[s]) return FIELD_LABELS[s];
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]+/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\s+/g, ' ').trim();
};

const stringifyItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item !== 'object') return fmtVal(item);
  if (Array.isArray(item)) return item.filter(v => hasVal(v)).map(v => stringifyItem(v)).join(', ');
  return Object.values(item).filter(v => hasVal(v)).map(v => (typeof v === 'object' ? stringifyItem(v) : fmtVal(v))).join(' - ');
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

/* objectRows: recursive box-free rendering of a nested object - each key -> subLabel, scalars -> value,
   arrays -> one value row per item, nested objects -> recurse. Mirrors the JSX renderObjectEntries. */
const objectRows = (obj) => {
  const out = [];
  Object.entries(obj).filter(([, v]) => hasVal(v)).forEach(([k, v], idx) => {
    const label = prettifyKey(k);
    if (Array.isArray(v)) {
      out.push(<Text key={`${idx}-l`} style={styles.subLabel}>{safeString(label)}</Text>);
      v.filter(it => hasVal(stringifyItem(it))).forEach((it, i) => out.push(<Text key={`${idx}-${i}`} style={styles.value}>{safeString(stringifyItem(it))}</Text>));
    } else if (v !== null && typeof v === 'object') {
      out.push(<Text key={`${idx}-l`} style={styles.subLabel}>{safeString(label)}</Text>);
      objectRows(v).forEach((node, i) => out.push(React.cloneElement(node, { key: `${idx}-n${i}` })));
    } else {
      out.push(<Text key={`${idx}-l`} style={styles.subLabel}>{safeString(label)}</Text>);
      out.push(<Text key={`${idx}-v`} style={styles.value}>{safeString(fmtVal(v))}</Text>);
    }
  });
  return out;
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.some(it => hasVal(stringifyItem(it)));
  if (OBJECT_FIELDS.includes(f)) return v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).some(sv => hasVal(sv));
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (OBJECT_FIELDS.includes(f)) return objectRows(v);
  if (ARRAY_FIELDS.includes(f)) return v.filter(it => hasVal(stringifyItem(it))).map((it, i) => <Text key={i} style={styles.value}>{safeString(stringifyItem(it))}</Text>);
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
  const present = fields.filter(f => fieldPresent(record, f));
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

const MedicalHistoryDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.medical_history) records = Array.isArray(data[0].medical_history) ? data[0].medical_history : [data[0].medical_history];
    else records = data;
  } else if (data?.medical_history) records = Array.isArray(data.medical_history) ? data.medical_history : [data.medical_history];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Medical History</Text>
          <Text style={styles.noData}>No medical history records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Medical History</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Medical History ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MedicalHistoryDocumentPDFTemplate;
