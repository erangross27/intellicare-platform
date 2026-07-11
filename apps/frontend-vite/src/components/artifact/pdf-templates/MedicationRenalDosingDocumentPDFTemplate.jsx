import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MedicationRenalDosingDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0) for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * adjustedMedications = array of objects -> each med decomposes into a subLabel (medication name) +
 * its sub-field value rows. contrastProtocol/results = nested objects -> recursive objectRows.
 * contraindicatedMedications/nephrotoxicExposures/recommendations = arrays -> numbered value rows.
 * Narrative strings (assessment/plan) use [.;] sentence-split with a \d list-marker guard + leading-strip
 * so the inline-numbered "Nephrotoxin Avoidance: 1. ... 2. ..." plan renders as subtitle + numbered rows.
 * Record date is the real record.date field - NEVER createdAt/updatedAt.
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
const SECTION_ORDER = ['record-info', 'adjusted-medications', 'contraindicated-meds', 'nephrotoxic-exposures', 'contrast-protocol', 'clinical-findings', 'recommendations', 'notes-results'];

const SECTION_TITLES = {
  'record-info': 'Record Information',
  'adjusted-medications': 'Adjusted Medications',
  'contraindicated-meds': 'Contraindicated Medications',
  'nephrotoxic-exposures': 'Nephrotoxic Exposures',
  'contrast-protocol': 'Contrast Protocol',
  'clinical-findings': 'Clinical Findings',
  'recommendations': 'Recommendations',
  'notes-results': 'Notes & Results',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  adjustedMedications: 'Adjusted Medications',
  contraindicatedMedications: 'Contraindicated Medications',
  nephrotoxicExposures: 'Nephrotoxic Exposures',
  contrastProtocol: 'Contrast Protocol',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
  results: 'Results',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility', 'status'],
  'adjusted-medications': ['adjustedMedications'],
  'contraindicated-meds': ['contraindicatedMedications'],
  'nephrotoxic-exposures': ['nephrotoxicExposures'],
  'contrast-protocol': ['contrastProtocol'],
  'clinical-findings': ['findings', 'assessment', 'plan'],
  'recommendations': ['recommendations'],
  'notes-results': ['notes', 'results'],
};

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = [];
const ARRAY_FIELDS = ['contraindicatedMedications', 'nephrotoxicExposures', 'recommendations'];
const OBJECT_ARRAY_FIELDS = ['adjustedMedications'];
const OBJECT_FIELDS = ['contrastProtocol', 'results'];

/* HELPERS (mirror the JSX) - safeString uses \uXXXX escapes ONLY (never literal smart-quotes/dashes/superscripts) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00B2/g, '2')
    .replace(/\u00B3/g, '3')
    .replace(/[\u00B5\u03BC]/g, 'u')
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

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]|\d))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma; nested "Outer: Inner: value" peels into
   stacked subLabels + a bare value (mirrors the JSX peelLabels; never side-by-side "Label: value"). */
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
        const labels = [p.label]; let value = p.value; let inner = parseLabel(value); let guard = 0;
        while (inner.isLabeled && splitByComma(inner.value).length < 2 && guard++ < 6) { labels.push(inner.label); value = inner.value; inner = parseLabel(value); }
        labels.forEach(l => rows.push({ type: 'sub', text: l }));
        rows.push({ type: 'item', text: value });
      }
    } else {
      rows.push({ type: 'item', text: sentence });
    }
  });
  return rows;
};

/* objectRows: recursively flatten a nested object into box-free rows (scalars inline "Key: value") */
const objectRows = (obj, kp) => {
  const out = [];
  Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '').forEach(([k, v], i) => {
    const key = `${kp}.${k}.${i}`;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (Object.keys(v).length === 0) return;
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      objectRows(v, key).forEach(r => out.push(r));
    } else if (Array.isArray(v)) {
      const items = v.filter(x => x !== null && x !== undefined && x !== '');
      if (items.length === 0) return;
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      items.forEach((it, j) => out.push(<Text key={key + '-' + j} style={styles.value}>{j + 1}. {safeString(typeof it === 'object' ? JSON.stringify(it) : fmtVal(it))}</Text>));
    } else {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      out.push(<Text key={key} style={styles.value}>{safeString(fmtVal(v))}</Text>);
    }
  });
  return out;
};

/* medRows: adjustedMedications array-of-objects -> subLabel (med name) + its sub-field value rows */
const MED_SUBFIELDS = [['standardDose', 'Standard Dose'], ['renalDose', 'Renal Dose'], ['frequency', 'Frequency'], ['indication', 'Indication']];
const medRows = (val) => {
  const meds = (Array.isArray(val) ? val : []).filter(m => m && typeof m === 'object');
  const out = [];
  meds.forEach((med, i) => {
    out.push(<Text key={'m' + i} style={styles.subLabel}>{safeString(med.medication || `Medication ${i + 1}`)}</Text>);
    MED_SUBFIELDS.forEach(([k, lab]) => {
      if (hasVal(med[k])) out.push(<Text key={`m${i}${k}`} style={styles.value}>{lab}: {safeString(fmtVal(med[k]))}</Text>);
    });
  });
  return out;
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(m => m && typeof m === 'object').length > 0;
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="d" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="n" style={styles.value}>{safeString(fmtVal(v))}</Text>];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return medRows(v);
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).filter(x => x !== null && x !== undefined && x !== '');
    return items.map((it, i) => {
      if (it && typeof it === 'object') {
        const t = it.recommendation || JSON.stringify(it);
        const d = it.date ? ` (${formatDate(it.date)})` : '';
        return <Text key={i} style={styles.value}>{i + 1}. {safeString(t)}{safeString(d)}</Text>;
      }
      return <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>;
    });
  }
  if (OBJECT_FIELDS.includes(f)) return objectRows(v, f);
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="s" style={styles.value}>{safeString(String(v))}</Text>];
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

const MedicationRenalDosingDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.medication_renal_dosing) records = Array.isArray(data[0].medication_renal_dosing) ? data[0].medication_renal_dosing : [data[0].medication_renal_dosing];
    else records = data;
  } else if (data?.medication_renal_dosing) records = Array.isArray(data.medication_renal_dosing) ? data.medication_renal_dosing : [data.medication_renal_dosing];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.medication_renal_dosing) records = Array.isArray(dd.medication_renal_dosing) ? dd.medication_renal_dosing : [dd.medication_renal_dosing]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Medication Renal Dosing</Text>
          <Text style={styles.noData}>No medication renal dosing records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Medication Renal Dosing</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Medication Renal Dosing ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MedicationRenalDosingDocumentPDFTemplate;
