import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MedicationSafetyDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (booleans as Yes/No) for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Nested objects (contrastRestrictions / renalDosingReview / drugInteractionMonitoring) resolve via
 * dotted paths; avoidMedications is an array-of-objects -> each object decomposes into a sub-label
 * (medication) + severity + reason value rows (mirrors the JSX; never side-by-side).
 * Record date = record.date - NEVER createdAt/updatedAt.
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
const SECTION_ORDER = ['general-info', 'avoid-medications', 'contrast-restrictions', 'renal-dosing', 'drug-interaction', 'clinical-notes', 'results-recommendations'];

const SECTION_TITLES = {
  'general-info': 'General Information',
  'avoid-medications': 'Avoid Medications',
  'contrast-restrictions': 'Contrast Restrictions',
  'renal-dosing': 'Renal Dosing Review',
  'drug-interaction': 'Drug Interaction Monitoring',
  'clinical-notes': 'Clinical Notes',
  'results-recommendations': 'Results & Recommendations',
};

const FIELD_LABELS = {
  type: 'Type',
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'avoidMedications': 'Avoid Medications',
  'contrastRestrictions.restricted': 'Restricted',
  'contrastRestrictions.requiresApproval': 'Requires Approval',
  'contrastRestrictions.approvalRequired': 'Approval Required',
  'contrastRestrictions.reason': 'Reason',
  'renalDosingReview.required': 'Required',
  'renalDosingReview.frequency': 'Frequency',
  'renalDosingReview.monitoring': 'Monitoring',
  'drugInteractionMonitoring.required': 'Required',
  'drugInteractionMonitoring.rationale': 'Rationale',
  'drugInteractionMonitoring.monitoringPlan': 'Monitoring Plan',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  results: 'Results',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'general-info': ['type', 'date', 'provider', 'facility', 'status'],
  'avoid-medications': ['avoidMedications'],
  'contrast-restrictions': ['contrastRestrictions.restricted', 'contrastRestrictions.requiresApproval', 'contrastRestrictions.approvalRequired', 'contrastRestrictions.reason'],
  'renal-dosing': ['renalDosingReview.required', 'renalDosingReview.frequency', 'renalDosingReview.monitoring'],
  'drug-interaction': ['drugInteractionMonitoring.required', 'drugInteractionMonitoring.rationale', 'drugInteractionMonitoring.monitoringPlan'],
  'clinical-notes': ['findings', 'assessment', 'plan', 'notes'],
  'results-recommendations': ['results', 'recommendations'],
};

const NUMBER_FIELDS = [];
const BOOLEAN_FIELDS = ['contrastRestrictions.restricted', 'contrastRestrictions.requiresApproval', 'renalDosingReview.required', 'drugInteractionMonitoring.required'];
const DATE_FIELDS = ['date'];
const OBJECT_ARRAY_FIELDS = ['avoidMedications'];

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

const resolvePath = (obj, p) => {
  if (!obj || !p) return undefined;
  return p.split('.').reduce((a, k) => (a === null || a === undefined ? undefined : a[k]), obj);
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

/* avoidMedications array-of-objects: each object -> sub-label (medication) + severity + reason value rows */
const medicationRows = (val) => {
  const meds = (Array.isArray(val) ? val : []).filter(m => m && (m.medication || m.severity || m.reason));
  return meds.map((med, i) => (
    <View key={i} wrap={false}>
      <Text style={styles.subLabel}>{safeString(med.medication || `Medication ${i + 1}`)}</Text>
      {med.severity ? <Text style={styles.value}>{safeString(`Severity: ${med.severity}`)}</Text> : null}
      {med.reason ? <Text style={styles.value}>{safeString(med.reason)}</Text> : null}
    </View>
  ));
};

const fieldPresent = (record, f) => {
  const v = resolvePath(record, f);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(m => m && (m.medication || m.severity || m.reason)).length > 0;
  return hasVal(v);
};

const fieldBody = (record, f) => {
  const v = resolvePath(record, f);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return medicationRows(v);
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
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

const MedicationSafetyDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.medication_safety) records = Array.isArray(data[0].medication_safety) ? data[0].medication_safety : [data[0].medication_safety];
    else records = data;
  } else if (data?.medication_safety) records = Array.isArray(data.medication_safety) ? data.medication_safety : [data.medication_safety];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Medication Safety</Text>
          <Text style={styles.noData}>No medication safety records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Medication Safety</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Medication Safety ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default MedicationSafetyDocumentPDFTemplate;
