import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PainMedicationAgreementsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (dates, booleans as Yes/No, numbers except 0,
 * arrays numbered) for JSX/PDF field parity. No boxes: underline rules only (documentTitle 2 /
 * recordTitle+sectionTitle 1 / fieldLabel 0.5). sectionTitle rides inside the first present field's
 * wrap={false} View (Rule #74). NEVER keys a record date off createdAt/updatedAt.
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordDate: { fontSize: 11, color: '#333333', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['provider-info', 'agreement-dates', 'medication-details', 'additional-medications', 'monitoring-compliance', 'prohibitions-acknowledgments', 'emergency-violations', 'non-pharmacologic'];

const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'agreement-dates': 'Agreement Dates',
  'medication-details': 'Medication Details',
  'additional-medications': 'Additional Prescribed Medications',
  'monitoring-compliance': 'Monitoring & Compliance',
  'prohibitions-acknowledgments': 'Prohibitions & Acknowledgments',
  'emergency-violations': 'Emergency Contact & Violations',
  'non-pharmacologic': 'Non-Pharmacologic Therapies Discussed',
};

const FIELD_LABELS = {
  prescribingPhysicianName: 'Prescribing Physician Name',
  prescribingPhysicianNpi: 'Prescribing Physician NPI',
  agreementEffectiveDate: 'Agreement Effective Date',
  agreementExpirationDate: 'Agreement Expiration Date',
  patientSignatureDate: 'Patient Signature Date',
  witnessName: 'Witness Name',
  primaryOpioidMedication: 'Primary Opioid Medication',
  opioidDosageAmount: 'Opioid Dosage Amount',
  morphineEquivalentDose: 'Morphine Equivalent Dose',
  primaryPainDiagnosis: 'Primary Pain Diagnosis',
  additionalPrescribedMedications: 'Additional Prescribed Medications',
  urineScreeningFrequency: 'Urine Screening Frequency',
  lastUrineScreenDate: 'Last Urine Screen Date',
  designatedPharmacy: 'Designated Pharmacy',
  earlyRefillProhibition: 'Early Refill Prohibition',
  multipleProviderProhibition: 'Multiple Provider Prohibition',
  pdmpReviewAcknowledged: 'PDMP Review Acknowledged',
  safeMedicationStorageAcknowledged: 'Safe Medication Storage Acknowledged',
  drivingImpairmentWarningAcknowledged: 'Driving Impairment Warning Acknowledged',
  pregnancyRiskAcknowledged: 'Pregnancy Risk Acknowledged',
  naloxonePrescribed: 'Naloxone Prescribed',
  emergencyContactName: 'Emergency Contact Name',
  emergencyContactPhone: 'Emergency Contact Phone',
  agreementViolationConsequences: 'Agreement Violation Consequences',
  nonPharmacologicTherapiesDiscussed: 'Non-Pharmacologic Therapies Discussed',
};

const SECTION_FIELDS = {
  'provider-info': ['prescribingPhysicianName', 'prescribingPhysicianNpi'],
  'agreement-dates': ['agreementEffectiveDate', 'agreementExpirationDate', 'patientSignatureDate', 'witnessName'],
  'medication-details': ['primaryOpioidMedication', 'opioidDosageAmount', 'morphineEquivalentDose', 'primaryPainDiagnosis'],
  'additional-medications': ['additionalPrescribedMedications'],
  'monitoring-compliance': ['urineScreeningFrequency', 'lastUrineScreenDate', 'designatedPharmacy'],
  'prohibitions-acknowledgments': ['earlyRefillProhibition', 'multipleProviderProhibition', 'pdmpReviewAcknowledged', 'safeMedicationStorageAcknowledged', 'drivingImpairmentWarningAcknowledged', 'pregnancyRiskAcknowledged', 'naloxonePrescribed'],
  'emergency-violations': ['emergencyContactName', 'emergencyContactPhone', 'agreementViolationConsequences'],
  'non-pharmacologic': ['nonPharmacologicTherapiesDiscussed'],
};

const NUMBER_FIELDS = ['morphineEquivalentDose'];
const DATE_FIELDS = ['agreementEffectiveDate', 'agreementExpirationDate', 'lastUrineScreenDate', 'patientSignatureDate'];
const BOOLEAN_FIELDS = ['earlyRefillProhibition', 'multipleProviderProhibition', 'pdmpReviewAcknowledged', 'safeMedicationStorageAcknowledged', 'drivingImpairmentWarningAcknowledged', 'pregnancyRiskAcknowledged', 'naloxonePrescribed'];
const ARRAY_FIELDS = ['additionalPrescribedMedications', 'nonPharmacologicTherapiesDiscussed'];

/* HELPERS (mirror the JSX) - safeString uses ONLY \uXXXX escapes (never literal smart-quotes) */
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

// Epoch 1970-01-01 is a "not set" sentinel - treat as empty (memory: template-epoch-date-sentinel-empty)
const isEpochDate = (v) => { if (!v) return false; const s = typeof v === 'string' ? v : (v && v.$date) ? v.$date : ''; return typeof s === 'string' && s.startsWith('1970-01-01'); };
const numberHasVal = (v) => { const n = Number(v); return Number.isFinite(n) && n !== 0; };
const fieldHasVal = (f, v) => {
  if (NUMBER_FIELDS.includes(f)) return numberHasVal(v);
  if (DATE_FIELDS.includes(f)) return hasVal(v) && !isEpochDate(v);
  return hasVal(v);
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

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v === true || v === 'true' || v === 'Yes' ? 'Yes' : 'No'}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(Number(v)))}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const arr = Array.isArray(v) ? v.filter(Boolean) : [];
    return arr.map((it, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(it)}`}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldHasVal(f, record[f]));
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

const PainMedicationAgreementsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && data.pain_medication_agreements) records = Array.isArray(data.pain_medication_agreements) ? data.pain_medication_agreements : [data.pain_medication_agreements];
  else if (data && data.documentData) { const dd = data.documentData; records = Array.isArray(dd) ? dd : (dd.pain_medication_agreements ? (Array.isArray(dd.pain_medication_agreements) ? dd.pain_medication_agreements : [dd.pain_medication_agreements]) : [dd]); }
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pain Medication Agreements</Text>
          <Text style={styles.noData}>No pain medication agreements records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pain Medication Agreements</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(record.prescribingPhysicianName || `Pain Medication Agreement ${rIdx + 1}`)}</Text>
            {hasVal(record.date) && !isEpochDate(record.date) && (
              <Text style={styles.recordDate}>{safeString(formatDate(record.date))}</Text>
            )}
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PainMedicationAgreementsDocumentPDFTemplate;
