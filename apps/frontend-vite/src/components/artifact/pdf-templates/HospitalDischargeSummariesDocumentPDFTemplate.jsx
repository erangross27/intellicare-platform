import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * HospitalDischargeSummariesDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0; arrays numbered; skip empty
 * arrays/strings) for JSX/PDF field parity. No boxes: underline rules only (documentTitle 2 /
 * recordTitle+sectionTitle 1 / fieldLabel 0.5). Rule #74: each field is ONE wrap={false} atomic
 * View with the sectionTitle riding INSIDE the first present field's View. NEVER keys a record
 * date off createdAt/updatedAt — uses the real record.date/admissionDate/dischargeDate.
 * Collection: hospital_discharge_summaries
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
const SECTION_ORDER = ['session-info', 'admission-discharge', 'clinical-summary', 'procedures-services', 'medications', 'safety-alerts', 'discharge-info', 'instructions-education', 'follow-up'];

const SECTION_TITLES = {
  'session-info': 'Session Information',
  'admission-discharge': 'Admission & Discharge Information',
  'clinical-summary': 'Clinical Summary',
  'procedures-services': 'Procedures & Consulting Services',
  'medications': 'Medications',
  'safety-alerts': 'Safety & Alerts',
  'discharge-info': 'Discharge Information',
  'instructions-education': 'Instructions & Education',
  'follow-up': 'Follow-Up Appointments',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  admissionDate: 'Admission Date',
  dischargeDate: 'Discharge Date',
  lengthOfStay: 'Length of Stay (days)',
  admittingComplaint: 'Admitting Complaint',
  principalDiagnosis: 'Principal Diagnosis',
  secondaryDiagnoses: 'Secondary Diagnoses',
  hospitalCourse: 'Hospital Course',
  proceduresPerformed: 'Procedures Performed',
  consultingServices: 'Consulting Services',
  dischargeMedications: 'Discharge Medications',
  medicationsDiscontinued: 'Medications Discontinued',
  allergiesAndAdverseReactions: 'Allergies & Adverse Reactions',
  criticalLabValues: 'Critical Lab Values',
  codeStatus: 'Code Status',
  dischargeCondition: 'Discharge Condition',
  dischargeDisposition: 'Discharge Disposition',
  functionalStatusAtDischarge: 'Functional Status at Discharge',
  dischargeInstructions: 'Discharge Instructions',
  patientEducationProvided: 'Patient Education Provided',
  followUpAppointments: 'Follow-Up Appointments',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility'],
  'admission-discharge': ['admissionDate', 'dischargeDate', 'lengthOfStay', 'admittingComplaint'],
  'clinical-summary': ['principalDiagnosis', 'secondaryDiagnoses', 'hospitalCourse'],
  'procedures-services': ['proceduresPerformed', 'consultingServices'],
  'medications': ['dischargeMedications', 'medicationsDiscontinued'],
  'safety-alerts': ['allergiesAndAdverseReactions', 'criticalLabValues', 'codeStatus'],
  'discharge-info': ['dischargeCondition', 'dischargeDisposition', 'functionalStatusAtDischarge'],
  'instructions-education': ['dischargeInstructions', 'patientEducationProvided'],
  'follow-up': ['followUpAppointments'],
};

const NUMBER_FIELDS = ['lengthOfStay'];
const DATE_FIELDS = ['date', 'admissionDate', 'dischargeDate'];
const ARRAY_FIELDS = ['secondaryDiagnoses', 'proceduresPerformed', 'consultingServices', 'dischargeMedications', 'medicationsDiscontinued', 'allergiesAndAdverseReactions', 'criticalLabValues', 'followUpAppointments'];

/* HELPERS (mirror the JSX) — safeString uses ONLY \uXXXX escapes (never literal smart-quotes/invisible chars) */
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
  if (Array.isArray(v)) return v.filter(x => hasVal(x)).length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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

/* Rule #74: render a field as ONE wrap={false} atomic View; sectionTitle rides inside the first View. */
const renderField = (record, f, sectionTitle, isFirst) => {
  const v = record[f];
  if (!hasVal(v)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  } else if (NUMBER_FIELDS.includes(f)) {
    body = [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : []).filter(x => hasVal(x));
    body = items.map((it, i) => {
      const p = parseLabel(String(it));
      return p.isLabeled
        ? <View key={i}><Text style={styles.subLabel}>{safeString(p.label)}</Text><Text style={styles.value}>{strip(p.value)}</Text></View>
        : <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>;
    });
  } else {
    const rows = sentenceRows(String(v));
    body = rows.length === 0
      ? [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>]
      : rows.map((r, i) => r.type === 'sub'
        ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
        : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
  }

  return [(
    <View key={f} style={styles.fieldWrap} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {body}
    </View>
  )];
};

const HospitalDischargeSummariesDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') {
    if (data.hospital_discharge_summaries) records = Array.isArray(data.hospital_discharge_summaries) ? data.hospital_discharge_summaries : [data.hospital_discharge_summaries];
    else if (data.documentData) { const dd = data.documentData; records = Array.isArray(dd) ? dd : (dd.hospital_discharge_summaries ? (Array.isArray(dd.hospital_discharge_summaries) ? dd.hospital_discharge_summaries : [dd.hospital_discharge_summaries]) : [dd]); }
    else records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Hospital Discharge Summaries</Text>
          <Text style={styles.noData}>No hospital discharge summaries records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Hospital Discharge Summaries</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Hospital Discharge Summary ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => {
              const present = (SECTION_FIELDS[sid] || []).filter(f => hasVal(record[f]));
              if (present.length === 0) return null;
              return (
                <View key={sid}>
                  {present.flatMap((f, i) => renderField(record, f, SECTION_TITLES[sid], i === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default HospitalDischargeSummariesDocumentPDFTemplate;
