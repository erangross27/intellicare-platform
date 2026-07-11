import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MedicationReconciliationDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0) for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Medication arrays are arrays-of-objects: a single-key {name} object renders its name as a value
 * row; a multi-key object renders the name as a subLabel + each populated sub-field as a value row
 * (mirrors the JSX; never side-by-side in the on-screen editor).
 * Record date is record.date - NEVER createdAt/updatedAt (ingestion timestamps).
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
const SECTION_ORDER = ['reconciliation-info', 'medications-added', 'medications-discontinued', 'medications-continued', 'medications-changed', 'drug-interactions', 'general-info', 'clinical-info', 'recommendations-results'];

const SECTION_TITLES = {
  'reconciliation-info': 'Reconciliation Information',
  'medications-added': 'Medications Added',
  'medications-discontinued': 'Medications Discontinued',
  'medications-continued': 'Medications Continued',
  'medications-changed': 'Medications Changed',
  'drug-interactions': 'Drug Interactions',
  'general-info': 'General Information',
  'clinical-info': 'Clinical Information',
  'recommendations-results': 'Recommendations & Results',
};

const FIELD_LABELS = {
  reconciliationDate: 'Reconciliation Date',
  reconciliationBy: 'Reconciled By',
  medicationsAdded: 'Medications Added',
  medicationsDiscontinued: 'Medications Discontinued',
  medicationsContinued: 'Medications Continued',
  medicationsChanged: 'Medications Changed',
  drugInteractions: 'Drug Interactions',
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
  status: 'Status',
};

const SECTION_FIELDS = {
  'reconciliation-info': ['reconciliationDate', 'reconciliationBy'],
  'medications-added': ['medicationsAdded'],
  'medications-discontinued': ['medicationsDiscontinued'],
  'medications-continued': ['medicationsContinued'],
  'medications-changed': ['medicationsChanged'],
  'drug-interactions': ['drugInteractions'],
  'general-info': ['date', 'type', 'provider', 'facility'],
  'clinical-info': ['findings', 'assessment', 'plan'],
  'recommendations-results': ['recommendations', 'results', 'notes', 'status'],
};

const NUMBER_FIELDS = [];
const DATE_FIELDS = ['reconciliationDate', 'date'];
const OBJECT_ARRAY_FIELDS = ['medicationsAdded', 'medicationsDiscontinued', 'medicationsContinued', 'medicationsChanged'];
const STRING_ARRAY_FIELDS = ['drugInteractions'];

/* medication sub-field defs per array (mirror the JSX) */
const MED_DEFS = {
  medicationsAdded: [
    { key: 'dose', label: 'Dose' }, { key: 'dosage', label: 'Dosage' }, { key: 'frequency', label: 'Frequency' },
    { key: 'indication', label: 'Indication' }, { key: 'startDate', label: 'Start Date', isDate: true },
    { key: 'reason', label: 'Reason' }, { key: 'note', label: 'Note' }, { key: 'notes', label: 'Notes' },
  ],
  medicationsDiscontinued: [
    { key: 'dose', label: 'Dose' }, { key: 'dosage', label: 'Dosage' }, { key: 'reason', label: 'Reason' },
    { key: 'discontinuedDate', label: 'Discontinued Date', isDate: true }, { key: 'note', label: 'Note' }, { key: 'notes', label: 'Notes' },
  ],
  medicationsContinued: [
    { key: 'dose', label: 'Dose' }, { key: 'dosage', label: 'Dosage' }, { key: 'frequency', label: 'Frequency' },
    { key: 'indication', label: 'Indication' }, { key: 'status', label: 'Status' }, { key: 'note', label: 'Note' }, { key: 'notes', label: 'Notes' },
  ],
  medicationsChanged: [
    { key: 'change', label: 'Change' }, { key: 'changeType', label: 'Change Type' }, { key: 'oldDose', label: 'Old Dose' },
    { key: 'previousDose', label: 'Previous Dose' }, { key: 'newDose', label: 'New Dose' }, { key: 'dose', label: 'Dose' },
    { key: 'reason', label: 'Reason' }, { key: 'note', label: 'Note' }, { key: 'notes', label: 'Notes' },
  ],
};

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

/* medRows: array-of-objects. Single-key {name} -> the name as a value row; multi-key -> name subLabel
   + each populated sub-field as its own value row. */
const medRows = (meds, defs) => {
  const items = (Array.isArray(meds) ? meds : []).filter(Boolean);
  const out = [];
  items.forEach((med, i) => {
    const name = safeString(med.name || med.medication || '');
    const present = (defs || []).filter(({ key }) => hasVal(med[key]));
    if (present.length === 0) {
      out.push(<Text key={`m${i}`} style={styles.value}>{name}</Text>);
    } else {
      out.push(<Text key={`m${i}`} style={styles.subLabel}>{name}</Text>);
      present.forEach(({ key, label, isDate }) => {
        const v = med[key];
        out.push(<Text key={`m${i}-${key}`} style={styles.value}>{safeString(label)}: {isDate ? safeString(formatDate(v)) : safeString(fmtVal(v))}</Text>);
      });
    }
  });
  return out;
};

/* stringArrayRows: array of plain strings -> one value row each */
const stringArrayRows = (items) => (Array.isArray(items) ? items : []).filter(hasVal)
  .map((it, i) => <Text key={i} style={styles.value}>{safeString(fmtVal(it))}</Text>);

/* recommendationRows: array of strings or {recommendation|text} objects, or a sentence string */
const recommendationRows = (val) => {
  if (Array.isArray(val)) {
    const items = val.filter(r => (typeof r === 'object' ? (r?.recommendation || r?.text) : String(r).trim()));
    return items.map((r, i) => <Text key={i} style={styles.value}>{safeString(typeof r === 'object' ? (r.recommendation || r.text || '') : String(r))}</Text>);
  }
  const rows = sentenceRows(String(val));
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const fieldPresent = (record, f) => {
  const v = record[f];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(Boolean).length > 0;
  if (STRING_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(hasVal).length > 0;
  if (f === 'recommendations') return Array.isArray(v) ? v.filter(r => (typeof r === 'object' ? (r?.recommendation || r?.text) : String(r).trim())).length > 0 : hasVal(v);
  if (f === 'results') { const s = safeString(v); return !!(s && s.trim() && s !== '{}'); }
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (OBJECT_ARRAY_FIELDS.includes(f)) return medRows(v, MED_DEFS[f]);
  if (STRING_ARRAY_FIELDS.includes(f)) return stringArrayRows(v);
  if (f === 'recommendations') return recommendationRows(v);
  if (f === 'results') return [<Text key="v" style={styles.value}>{safeString(v)}</Text>];
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

const MedicationReconciliationDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.medication_reconciliation) records = Array.isArray(data[0].medication_reconciliation) ? data[0].medication_reconciliation : [data[0].medication_reconciliation];
    else records = data;
  } else if (data?.medication_reconciliation) records = Array.isArray(data.medication_reconciliation) ? data.medication_reconciliation : [data.medication_reconciliation];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Medication Reconciliation</Text>
          <Text style={styles.noData}>No medication reconciliation records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Medication Reconciliation</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Medication Reconciliation ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MedicationReconciliationDocumentPDFTemplate;
