import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * OncologyFollowupReportsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers hide 0) for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Generic recursion: resolvePath (dotted paths e.g. radiationTherapy.site) + objectRows (nested
 * objects / arrays-of-objects) + fieldBody. Record date is record.date - NEVER createdAt/updatedAt.
 * safeString uses \uXXXX escapes ONLY (never literal smart-quotes/em-dashes/BOM).
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
const SECTION_ORDER = ['followup-info', 'cancer-overview', 'progression-free', 'treatment-info', 'performance-status', 'tumor-markers', 'imaging-results', 'radiation-therapy', 'adverse-events', 'symptoms-reported', 'supportive-medications', 'surgical-history', 'genetic-mutations', 'upcoming-care'];

const SECTION_TITLES = {
  'followup-info': 'Follow-up Information',
  'cancer-overview': 'Cancer Overview',
  'progression-free': 'Progression-Free Interval',
  'treatment-info': 'Treatment Information',
  'performance-status': 'Performance Status',
  'tumor-markers': 'Tumor Markers',
  'imaging-results': 'Imaging Results',
  'radiation-therapy': 'Radiation Therapy',
  'adverse-events': 'Adverse Events',
  'symptoms-reported': 'Symptoms Reported',
  'supportive-medications': 'Supportive Medications',
  'surgical-history': 'Surgical History',
  'genetic-mutations': 'Genetic Mutations',
  'upcoming-care': 'Upcoming Care',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  cancerType: 'Cancer Type',
  cancerStage: 'Cancer Stage',
  currentDiseaseStatus: 'Current Disease Status',
  diagnosisDate: 'Diagnosis Date',
  progressionFreeInterval: 'Progression-Free Interval',
  treatmentRegimen: 'Treatment Regimen',
  treatmentIntent: 'Treatment Intent',
  treatmentStartDate: 'Treatment Start Date',
  cycleDayNumber: 'Cycle Day Number',
  performanceStatus: 'Performance Status',
  tumorMarkers: 'Tumor Markers',
  imagingModality: 'Imaging Modality',
  imagingDate: 'Imaging Date',
  'radiationTherapy.site': 'Site',
  'radiationTherapy.totalDose': 'Total Dose',
  'radiationTherapy.fractions': 'Fractions',
  'radiationTherapy.completionDate': 'Completion Date',
  adverseEvents: 'Adverse Events',
  symptomsReported: 'Symptoms Reported',
  supportiveMedications: 'Supportive Medications',
  surgicalHistory: 'Surgical History',
  geneticMutations: 'Genetic Mutations',
  nextFollowupDate: 'Next Follow-up Date',
  nextTreatmentDate: 'Next Treatment Date',
  weightChange: 'Weight Change',
};

const SECTION_FIELDS = {
  'followup-info': ['date', 'provider', 'facility'],
  'cancer-overview': ['cancerType', 'cancerStage', 'currentDiseaseStatus', 'diagnosisDate'],
  'progression-free': ['progressionFreeInterval'],
  'treatment-info': ['treatmentRegimen', 'treatmentIntent', 'treatmentStartDate', 'cycleDayNumber'],
  'performance-status': ['performanceStatus'],
  'tumor-markers': ['tumorMarkers'],
  'imaging-results': ['imagingModality', 'imagingDate'],
  'radiation-therapy': ['radiationTherapy.site', 'radiationTherapy.totalDose', 'radiationTherapy.fractions', 'radiationTherapy.completionDate'],
  'adverse-events': ['adverseEvents'],
  'symptoms-reported': ['symptomsReported'],
  'supportive-medications': ['supportiveMedications'],
  'surgical-history': ['surgicalHistory'],
  'genetic-mutations': ['geneticMutations'],
  'upcoming-care': ['nextFollowupDate', 'nextTreatmentDate', 'weightChange'],
};

const NUMBER_FIELDS = ['cycleDayNumber', 'weightChange', 'progressionFreeInterval'];
const DATE_FIELDS = ['date', 'diagnosisDate', 'treatmentStartDate', 'imagingDate', 'nextFollowupDate', 'nextTreatmentDate', 'radiationTherapy.completionDate'];
const ARRAY_FIELDS = ['tumorMarkers', 'adverseEvents', 'symptomsReported', 'supportiveMedications', 'geneticMutations'];

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

const resolvePath = (obj, p) => { if (!obj || !p) return undefined; return String(p).split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj); };

// hide-zero: a numeric 0 counts as empty (memory numeric-0-is-empty rule).
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => hasVal(x)).length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

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
// Epoch 1970-01-01 is a "not set" sentinel -> treat as empty.
const isEpoch = (v) => { if (!v) return false; try { const d = new Date(v.$date || v); return d.getTime() === 0 || String(d.toISOString()).startsWith('1970-01-01'); } catch { return false; } };

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

/* Recursively flatten a nested object / array-of-objects into box-free rows. */
const objectRows = (obj, kp) => {
  const out = [];
  Object.entries(obj).filter(([, v]) => hasVal(v)).forEach(([k, v], i) => {
    const key = `${kp}.${k}.${i}`;
    if (isScalar(v)) {
      out.push(<Text key={key} style={styles.value}>{safeString(humanizeKey(k))}: {safeString(fmtScalar(v))}</Text>);
    } else if (Array.isArray(v)) {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      v.filter(x => hasVal(x)).forEach((it, j) => {
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

const fieldBody = (record, f) => {
  const v = resolvePath(record, f);
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(fmtScalar(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).filter(x => hasVal(x));
    const out = [];
    items.forEach((it, i) => {
      if (!isScalar(it)) { objectRows(it, f + i).forEach(r => out.push(r)); return; }
      const p = parseLabel(String(it));
      if (p.isLabeled) {
        out.push(<Text key={i + 'l'} style={styles.subLabel}>{safeString(p.label)}</Text>);
        out.push(<Text key={i + 'v'} style={styles.value}>{strip(p.value)}</Text>);
      } else {
        out.push(<Text key={i} style={styles.value}>{i + 1}. {strip(String(it))}</Text>);
      }
    });
    return out;
  }
  if (!isScalar(v)) return objectRows(v, f);
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const fieldPresent = (record, f) => {
  const v = resolvePath(record, f);
  if (DATE_FIELDS.includes(f)) return hasVal(v) && !isEpoch(v);
  return hasVal(v);
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

const OncologyFollowupReportsDocumentPDFTemplate = ({ document: docProp, records, data }) => {
  const source = docProp !== undefined ? docProp : (data !== undefined ? data : records);
  let recs = [];
  if (Array.isArray(source)) {
    if (source.length === 1 && source[0]?.oncology_followup_reports) recs = Array.isArray(source[0].oncology_followup_reports) ? source[0].oncology_followup_reports : [source[0].oncology_followup_reports];
    else recs = source;
  } else if (source?.oncology_followup_reports) recs = Array.isArray(source.oncology_followup_reports) ? source.oncology_followup_reports : [source.oncology_followup_reports];
  else if (source?.documentData) { const dd = source.documentData; if (Array.isArray(dd)) recs = dd; else if (dd?.oncology_followup_reports) recs = Array.isArray(dd.oncology_followup_reports) ? dd.oncology_followup_reports : [dd.oncology_followup_reports]; else if (dd && typeof dd === 'object') recs = [dd]; }
  else if (source && typeof source === 'object') recs = [source];
  recs = recs.filter(r => r && typeof r === 'object');

  if (recs.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Oncology Follow-up Reports</Text>
          <Text style={styles.noData}>No oncology follow-up reports available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Oncology Follow-up Reports</Text>
        {recs.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Oncology Follow-up Report ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default OncologyFollowupReportsDocumentPDFTemplate;
