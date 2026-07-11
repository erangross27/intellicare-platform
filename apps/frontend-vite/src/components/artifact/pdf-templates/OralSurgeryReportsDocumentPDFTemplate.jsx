import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * OralSurgeryReportsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (booleans incl. false, numbers > 0) for JSX/PDF parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * No top-level `date` field -> TITLE-ONLY record header (no date badge).
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
const SECTION_ORDER = ['procedure', 'anesthesia', 'surgical-technique', 'graft-implant', 'postoperative'];

const SECTION_TITLES = {
  'procedure': 'Procedure',
  'anesthesia': 'Anesthesia',
  'surgical-technique': 'Surgical Technique',
  'graft-implant': 'Graft and Implant',
  'postoperative': 'Postoperative',
};

const FIELD_LABELS = {
  procedureType: 'Procedure Type',
  toothNumber: 'Tooth Number',
  procedureDuration: 'Procedure Duration',
  extractionDifficulty: 'Extraction Difficulty',
  impactionClass: 'Impaction Class',
  impactionPosition: 'Impaction Position',
  anesthesiaType: 'Anesthesia Type',
  anestheticAgent: 'Anesthetic Agent',
  anestheticVolume: 'Anesthetic Volume',
  boneRemoval: 'Bone Removal',
  toothSectioning: 'Tooth Sectioning',
  sutureType: 'Suture Type',
  sutureCount: 'Suture Count',
  hemostasisMethod: 'Hemostasis Method',
  graftMaterial: 'Graft Material',
  graftVolume: 'Graft Volume',
  membraneType: 'Membrane Type',
  implantDiameter: 'Implant Diameter',
  implantLength: 'Implant Length',
  primaryStability: 'Primary Stability',
  insertionTorque: 'Insertion Torque',
  complications: 'Complications',
  antibioticProphylaxis: 'Antibiotic Prophylaxis',
  painManagement: 'Pain Management',
  followUpInterval: 'Follow-up Interval',
};

const SECTION_FIELDS = {
  'procedure': ['procedureType', 'toothNumber', 'procedureDuration', 'extractionDifficulty', 'impactionClass', 'impactionPosition'],
  'anesthesia': ['anesthesiaType', 'anestheticAgent', 'anestheticVolume'],
  'surgical-technique': ['boneRemoval', 'toothSectioning', 'sutureType', 'sutureCount', 'hemostasisMethod'],
  'graft-implant': ['graftMaterial', 'graftVolume', 'membraneType', 'implantDiameter', 'implantLength', 'primaryStability', 'insertionTorque'],
  'postoperative': ['complications', 'antibioticProphylaxis', 'painManagement', 'followUpInterval'],
};

const NARRATIVE_STRING_FIELDS = ['painManagement'];
const BOOLEAN_FIELDS = ['boneRemoval', 'toothSectioning'];
const NUMBER_FIELDS = ['sutureCount', 'implantDiameter', 'implantLength', 'insertionTorque', 'procedureDuration'];
const ARRAY_FIELDS = ['complications'];

/* HELPERS (mirror the JSX) */
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

/* numeric presence check - 0 and absent are hidden, never truthiness */
const hasNumber = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
};

/* boolean presence check - false is DATA, only null/undefined hidden */
const hasBoolean = (v) => {
  if (typeof v === 'boolean') return true;
  if (v === 'true' || v === 'false') return true;
  return false;
};

const hasArray = (v) => Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;

const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
};

const fieldHasVal = (fn, v) => {
  if (NUMBER_FIELDS.includes(fn)) return hasNumber(v);
  if (BOOLEAN_FIELDS.includes(fn)) return hasBoolean(v);
  if (ARRAY_FIELDS.includes(fn)) return hasArray(v);
  return hasString(v);
};

// A hide-zero number field stays visible at 0 when a doctor explicitly set it (doctorEdits.editedFields)
const fieldVisible = (record, fn) => fieldHasVal(fn, record[fn]) || (NUMBER_FIELDS.includes(fn) && Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn));

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

const fieldBody = (record, f) => {
  const v = record[f];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) {
    const b = (v === true || v === 'true');
    return [<Text key="v" style={styles.value}>{b ? 'Yes' : 'No'}</Text>];
  }
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : [v]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    return items.map((item, i) => {
      const p = parseLabel(String(item));
      return <Text key={i} style={styles.value}>{i + 1}. {strip(p.value || String(item))}</Text>;
    });
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (NARRATIVE_STRING_FIELDS.includes(f) && rows.length > 1) {
    return rows.map((r, i) => r.type === 'sub'
      ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
      : <Text key={i} style={styles.value}>{i + 1}. {strip(r.text)}</Text>);
  }
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldVisible(record, f));
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

const OralSurgeryReportsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  const pick = (r) => r && r.oral_surgery_reports;
  let records = [];
  if (Array.isArray(data)) {
    const p0 = data.length > 0 ? pick(data[0]) : null;
    records = (p0 && Array.isArray(p0)) ? p0 : data;
  } else if (data && pick(data)) {
    const p = pick(data);
    records = Array.isArray(p) ? p : [p];
  } else if (data && typeof data === 'object') {
    records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Oral Surgery Reports</Text>
          <Text style={styles.noData}>No oral surgery report records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Oral Surgery Reports</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Oral Surgery Report ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default OralSurgeryReportsDocumentPDFTemplate;
