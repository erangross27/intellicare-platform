import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * OccupationalExposureRecordsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. doctor-edited 0, booleans, dates,
 * arrays) for JSX/PDF field parity. No boxes: underline rules only
 * (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordDate: { fontSize: 12, color: '#333333', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['exposure-event', 'source-agent', 'employee-ppe', 'prophylaxis-serology', 'reporting-risk'];

const SECTION_TITLES = {
  'exposure-event': 'Exposure Event',
  'source-agent': 'Source and Agent',
  'employee-ppe': 'Employee and PPE',
  'prophylaxis-serology': 'Prophylaxis and Serology',
  'reporting-risk': 'Reporting and Risk',
};

const FIELD_LABELS = {
  exposureType: 'Exposure Type',
  exposureDateTime: 'Exposure Date/Time',
  exposureLocation: 'Exposure Location',
  exposureRoute: 'Exposure Route',
  exposureSeverity: 'Exposure Severity',
  exposureCircumstances: 'Exposure Circumstances',
  sourcePatientIdentifier: 'Source Patient Identifier',
  sourcePatientInfectionStatus: 'Source Patient Infection Status',
  chemicalAgentName: 'Chemical Agent Name',
  sharpsDeviceType: 'Sharps Device Type',
  employeeJobTitle: 'Employee Job Title',
  departmentOfExposure: 'Department of Exposure',
  personalProtectiveEquipmentUsed: 'Personal Protective Equipment Used',
  immediateDecontaminationPerformed: 'Immediate Decontamination Performed',
  baselineSerologyOrdered: 'Baseline Serology Ordered',
  postExposureProphylaxisInitiated: 'Post-Exposure Prophylaxis Initiated',
  pepMedicationRegimen: 'PEP Medication Regimen',
  hepatitisBVaccinationStatus: 'Hepatitis B Vaccination Status',
  hbigAdministered: 'HBIG Administered',
  followUpSchedule: 'Follow-Up Schedule',
  oshaRecordableInjury: 'OSHA Recordable Injury',
  workersCompensationClaim: 'Workers Compensation Claim',
  supervisorNotified: 'Supervisor Notified',
  infectionControlNotified: 'Infection Control Notified',
  riskAssessmentScore: 'Risk Assessment Score',
};

const SECTION_FIELDS = {
  'exposure-event': ['exposureType', 'exposureDateTime', 'exposureLocation', 'exposureRoute', 'exposureSeverity', 'exposureCircumstances'],
  'source-agent': ['sourcePatientIdentifier', 'sourcePatientInfectionStatus', 'chemicalAgentName', 'sharpsDeviceType'],
  'employee-ppe': ['employeeJobTitle', 'departmentOfExposure', 'personalProtectiveEquipmentUsed', 'immediateDecontaminationPerformed'],
  'prophylaxis-serology': ['baselineSerologyOrdered', 'postExposureProphylaxisInitiated', 'pepMedicationRegimen', 'hepatitisBVaccinationStatus', 'hbigAdministered', 'followUpSchedule'],
  'reporting-risk': ['oshaRecordableInjury', 'workersCompensationClaim', 'supervisorNotified', 'infectionControlNotified', 'riskAssessmentScore'],
};

const DATE_FIELDS = [];
const DATETIME_FIELDS = ['exposureDateTime'];
const NUMBER_FIELDS = ['riskAssessmentScore'];
const BOOLEAN_FIELDS = ['immediateDecontaminationPerformed', 'postExposureProphylaxisInitiated', 'hbigAdministered', 'oshaRecordableInjury', 'supervisorNotified', 'infectionControlNotified'];
const ARRAY_FIELDS = ['personalProtectiveEquipmentUsed', 'baselineSerologyOrdered', 'followUpSchedule'];

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
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* exposureDateTime is a true timestamp - preserve time-of-day */
const formatDateTime = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return String(dateValue); }
};

/* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  return true;
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

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (DATETIME_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDateTime(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(v) ? v.filter(x => x && String(x).trim()) : [];
    return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(String(it))}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

/* field presence respecting hide-zero + boolean */
const fieldPresent = (record, f) => {
  if (NUMBER_FIELDS.includes(f)) return numberShowsPDF(record, f);
  if (BOOLEAN_FIELDS.includes(f)) return typeof record[f] === 'boolean';
  return hasVal(record[f]);
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

const OccupationalExposureRecordsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Occupational Exposure Record</Text>
          <Text style={styles.noData}>No occupational exposure record data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Occupational Exposure Record</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Occupational Exposure Record ${rIdx + 1}`)}</Text>
            {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default OccupationalExposureRecordsDocumentPDFTemplate;
