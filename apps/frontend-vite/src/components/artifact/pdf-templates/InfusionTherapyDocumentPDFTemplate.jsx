import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * InfusionTherapyDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (JSX/PDF field parity), skipping empty.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * sectionTitle rides INSIDE the first present field's own wrap={false} View (no orphaned title).
 * Field handling mirrors the JSX: DATE (formatted, epoch/null hidden), ARRAY (numbered items),
 * NARRATIVE (numbered sentences when multi-sentence), else plain value.
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  listItem: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['infusion', 'vascular-access', 'vitals-labs', 'safety', 'clinical-timing'];

const SECTION_TITLES = {
  'infusion': 'Infusion',
  'vascular-access': 'Vascular Access',
  'vitals-labs': 'Vitals & Labs',
  'safety': 'Safety',
  'clinical-timing': 'Clinical & Timing',
};

const FIELD_LABELS = {
  infusionMedication: 'Infusion Medication',
  infusionDose: 'Infusion Dose',
  infusionRate: 'Infusion Rate',
  infusionDuration: 'Infusion Duration',
  totalVolumeAdministered: 'Total Volume Administered',
  diluentSolution: 'Diluent Solution',
  infusionPumpType: 'Infusion Pump Type',
  infusionProtocol: 'Infusion Protocol',
  vascularAccessType: 'Vascular Access Type',
  vascularAccessSite: 'Vascular Access Site',
  vascularAccessGauge: 'Vascular Access Gauge',
  preInfusionVitalSigns: 'Pre-Infusion Vital Signs',
  postInfusionVitalSigns: 'Post-Infusion Vital Signs',
  patientWeight: 'Patient Weight',
  bodyMassIndex: 'Body Mass Index',
  estimatedGlomerularFiltrationRate: 'Estimated Glomerular Filtration Rate',
  laboratoryMonitoring: 'Laboratory Monitoring',
  premedications: 'Premedications',
  allergyScreening: 'Allergy Screening',
  concurrentMedications: 'Concurrent Medications',
  infusionComplications: 'Infusion Complications',
  infusionTolerability: 'Infusion Tolerability',
  therapeuticIndication: 'Therapeutic Indication',
  infusionStartTime: 'Infusion Start Time',
  infusionEndTime: 'Infusion End Time',
};

const SECTION_FIELDS = {
  'infusion': ['infusionMedication', 'infusionDose', 'infusionRate', 'infusionDuration', 'totalVolumeAdministered', 'diluentSolution', 'infusionPumpType', 'infusionProtocol'],
  'vascular-access': ['vascularAccessType', 'vascularAccessSite', 'vascularAccessGauge'],
  'vitals-labs': ['preInfusionVitalSigns', 'postInfusionVitalSigns', 'patientWeight', 'bodyMassIndex', 'estimatedGlomerularFiltrationRate', 'laboratoryMonitoring'],
  'safety': ['premedications', 'allergyScreening', 'concurrentMedications', 'infusionComplications', 'infusionTolerability'],
  'clinical-timing': ['therapeuticIndication', 'infusionStartTime', 'infusionEndTime'],
};

const NARRATIVE_STRING_FIELDS = ['therapeuticIndication', 'infusionProtocol'];
const DATE_FIELDS = ['infusionStartTime', 'infusionEndTime'];
const ARRAY_FIELDS = ['infusionComplications', 'premedications', 'laboratoryMonitoring', 'allergyScreening', 'concurrentMedications'];

/* HELPERS (mirror the JSX) — safeString uses ONLY \uXXXX escapes (never literal smart-quotes) */
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

/* date presence + format — null / 1970-epoch hidden */
const parseDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  let d;
  if (v instanceof Date) d = v;
  else if (typeof v === 'object' && v.$date) d = new Date(v.$date);
  else d = new Date(v);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() <= 0 || d.getUTCFullYear() <= 1970) return null;
  return d;
};
const hasDate = (v) => parseDate(v) !== null;
const fmtDate = (v) => {
  const d = parseDate(v);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

/* time-bearing detection — mirror the JSX so the PDF shows the time when present */
const hasTimeComponent = (v) => {
  if (v instanceof Date) return v.getHours() !== 0 || v.getMinutes() !== 0 || v.getSeconds() !== 0;
  const s = (typeof v === 'object' && v && v.$date) ? v.$date : v;
  if (typeof s !== 'string') return false;
  const m = s.match(/T(\d{2}):(\d{2})/);
  if (!m) return false;
  return !(m[1] === '00' && m[2] === '00');
};
const parseDateTimeLocal = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = (typeof v === 'object' && v && v.$date) ? v.$date : v;
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const fmtDateTime = (v) => {
  if (!hasTimeComponent(v)) return fmtDate(v);
  const d = parseDateTimeLocal(v);
  if (!d) return fmtDate(v);
  return d.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const hasArray = (v) => Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
};
const fieldHasVal = (fn, v) => {
  if (DATE_FIELDS.includes(fn)) return hasDate(v);
  if (ARRAY_FIELDS.includes(fn)) return hasArray(v);
  return hasString(v);
};
const fieldVisible = (record, fn) => fieldHasVal(fn, record[fn]);

/* parseLabel: detect "Label: value" patterns (skip subordinate-clause openers) */
const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* fieldBody: DATE → formatted value; ARRAY → numbered items; NARRATIVE → numbered sentences
   when multi-sentence (mirrors the JSX screen rendering); else a plain value line. */
const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(fmtDateTime(v))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : [v]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    return items.map((item, i) => {
      const p = parseLabel(String(item));
      return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(p.value || String(item))}</Text>;
    });
  }
  const strVal = safeString(v);
  const sentences = splitBySentence(strVal);
  if (NARRATIVE_STRING_FIELDS.includes(f) && sentences.length > 1) {
    return sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {strip(s)}</Text>);
  }
  return [<Text key="v" style={styles.value}>{strVal}</Text>];
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

const InfusionTherapyDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  const pick = (r) => r && r.infusion_therapy;
  let records = [];
  if (Array.isArray(data)) {
    const p0 = data.length > 0 ? pick(data[0]) : null;
    records = (p0 && Array.isArray(p0)) ? p0 : data;
  } else if (data && pick(data)) {
    const p = pick(data); records = Array.isArray(p) ? p : [p];
  } else if (data) {
    records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Infusion Therapy</Text>
          <Text style={styles.noData}>No infusion therapy data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Infusion Therapy</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Infusion Therapy ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default InfusionTherapyDocumentPDFTemplate;
