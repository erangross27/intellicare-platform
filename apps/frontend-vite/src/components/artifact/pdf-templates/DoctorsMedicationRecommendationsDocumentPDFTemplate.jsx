/**
 * DoctorsMedicationRecommendationsDocumentPDFTemplate.jsx
 * July 2026 — box-free canonical — LETTER — BLACK & WHITE ONLY (#000000)
 *
 * DUAL SCHEMA (mirrors the JSX component). Both collections route here:
 *   - FLAT (singular legacy) doctors_medication_recommendations:
 *       date, medication, dosage, frequency, duration, indication, route, priority, provider
 *   - UNIFIED (plural)       doctors_medications_recommendations: 28-field schema
 * The active config is chosen from records[0] (a view is always one collection).
 *
 * Canonical polish: box-free; numbered value rows ("1." even for singles); single-name rule
 * (field label == section title → label hidden); section title rides INSIDE the first field's
 * glue View; per-field wrap={false} anti-orphan; break={idx>0}.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center' },
  recordContainer: { paddingBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ═══════ CONFIG — UNIFIED (plural) ═══════ */
const UNIFIED_SECTION_TITLES = { 'medication-details': 'Medication Details', 'prescription': 'Prescription', 'clinical-rationale': 'Clinical Rationale', 'safety': 'Safety', 'context': 'Context' };
const UNIFIED_FIELD_LABELS = {
  prescribedMedication: 'Prescribed Medication', medicationClass: 'Medication Class', dosageAmount: 'Dosage Amount', dosageFrequency: 'Dosage Frequency',
  routeOfAdministration: 'Route of Administration', durationOfTreatment: 'Duration of Treatment', specialInstructions: 'Special Instructions',
  prescriptionStartDate: 'Prescription Start Date', prescriptionEndDate: 'Prescription End Date', refillsAuthorized: 'Refills Authorized',
  requiresPriorAuthorization: 'Requires Prior Authorization', prescriptionMethod: 'Prescription Method', pharmacyDetails: 'Pharmacy Details',
  indicationForUse: 'Indication for Use', therapeuticGoal: 'Therapeutic Goal', priorMedicationTrials: 'Prior Medication Trials',
  alternativeMedicationsConsidered: 'Alternative Medications Considered', reasonForChange: 'Reason for Change', knownAllergies: 'Known Allergies',
  contraindicationsNoted: 'Contraindications Noted', potentialInteractions: 'Potential Interactions', adverseEffectsDiscussed: 'Adverse Effects Discussed',
  monitoringParameters: 'Monitoring Parameters', provider: 'Provider', facility: 'Facility', followUpRecommendation: 'Follow-Up Recommendation',
  patientCounselingCompleted: 'Patient Counseling Completed', date: 'Date',
};
const UNIFIED_SECTION_FIELDS = {
  'medication-details': ['prescribedMedication', 'medicationClass', 'dosageAmount', 'dosageFrequency', 'routeOfAdministration', 'durationOfTreatment', 'specialInstructions'],
  'prescription': ['prescriptionStartDate', 'prescriptionEndDate', 'refillsAuthorized', 'requiresPriorAuthorization', 'prescriptionMethod', 'pharmacyDetails'],
  'clinical-rationale': ['indicationForUse', 'therapeuticGoal', 'priorMedicationTrials', 'alternativeMedicationsConsidered', 'reasonForChange'],
  'safety': ['knownAllergies', 'contraindicationsNoted', 'potentialInteractions', 'adverseEffectsDiscussed', 'monitoringParameters'],
  'context': ['provider', 'facility', 'followUpRecommendation', 'patientCounselingCompleted', 'date'],
};
const UNIFIED_NARRATIVE_FIELDS = ['indicationForUse', 'specialInstructions', 'therapeuticGoal', 'followUpRecommendation', 'reasonForChange'];
const UNIFIED_NUMBER_FIELDS = ['refillsAuthorized'];
const UNIFIED_DATE_FIELDS = ['date', 'prescriptionStartDate', 'prescriptionEndDate'];
const UNIFIED_ARRAY_FIELDS = ['contraindicationsNoted', 'knownAllergies', 'potentialInteractions', 'monitoringParameters', 'adverseEffectsDiscussed', 'alternativeMedicationsConsidered', 'priorMedicationTrials'];
const UNIFIED_ENUM_FIELDS = {};

/* ═══════ CONFIG — FLAT (singular legacy) ═══════ */
const FLAT_SECTION_TITLES = { 'medication': 'Medication', 'clinical-rationale': 'Clinical Rationale', 'context': 'Context' };
const FLAT_FIELD_LABELS = { medication: 'Medication', dosage: 'Dosage', frequency: 'Frequency', route: 'Route', duration: 'Duration', indication: 'Indication', priority: 'Priority', provider: 'Provider', date: 'Date' };
const FLAT_SECTION_FIELDS = { 'medication': ['medication', 'dosage', 'frequency', 'route', 'duration'], 'clinical-rationale': ['indication', 'priority'], 'context': ['provider', 'date'] };
const FLAT_NARRATIVE_FIELDS = ['indication'];
const FLAT_NUMBER_FIELDS = [];
const FLAT_DATE_FIELDS = ['date'];
const FLAT_ARRAY_FIELDS = [];
const FLAT_ENUM_FIELDS = {
  route: ['Oral', 'Sublingual', 'Buccal', 'Intravenous (IV)', 'Intramuscular (IM)', 'Subcutaneous', 'Topical', 'Transdermal', 'Inhaled', 'Nasal', 'Rectal', 'Ophthalmic', 'Otic'],
  priority: ['Low', 'Medium', 'High'],
};

const isFlatRecord = (r) => !!r && typeof r === 'object' && (
  Object.prototype.hasOwnProperty.call(r, 'medication') ||
  Object.prototype.hasOwnProperty.call(r, 'indication') ||
  Object.prototype.hasOwnProperty.call(r, 'priority')
) && !Object.prototype.hasOwnProperty.call(r, 'prescribedMedication');

const enumCanonical = (options, current) => {
  if (current === null || current === undefined || String(current).trim() === '') return '';
  const c = String(current).trim().toLowerCase();
  const match = (options || []).find(o => o.toLowerCase() === c);
  return match || String(current).trim();
};

/* ═══════ UTILS ═══════ */
const hasNumber = (v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); return Number.isFinite(n) && n !== 0; };
const parseDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  let d;
  if (v instanceof Date) d = v; else if (typeof v === 'object' && v.$date) d = new Date(v.$date); else d = new Date(v);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() <= 0 || d.getUTCFullYear() <= 1970) return null;
  return d;
};
const hasDate = (v) => parseDate(v) !== null;
const fmtDate = (v) => { const d = parseDate(v); if (!d) return ''; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); };
const hasArray = (v) => Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
const hasString = (v) => { if (v === null || v === undefined) return false; if (typeof v === 'string') return v.trim() !== ''; if (typeof v === 'number') return v !== 0; return String(v).trim() !== ''; };
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const splitBySemicolon = (text) => (!text || typeof text !== 'string') ? [] : text.split(/;\s*/).map(s => s.trim()).filter(Boolean);

/* guarded comma split (paren-aware; skip no-space commas; keep Oxford and/or; skip date commas) */
const splitGuardedComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const noSpace = s[i + 1] !== ' ';
      let j = i + 1; while (j < s.length && s[j] === ' ') j++;
      const rest = s.slice(j); const nextChar = s[j] || '';
      const andOrAfter = /^(and|or)\b/i.test(rest);
      const andOrBefore = /\b(and|or)\s*$/i.test(cur);
      const dateComma = /\d\s*$/.test(cur) && /^\d{4}\b/.test(rest);
      const nextOk = /[A-Za-z(>]/.test(nextChar);
      if (!noSpace && !andOrAfter && !andOrBefore && !dateComma && nextOk) { const p = cur.trim(); if (p) out.push(p); cur = ''; continue; }
    }
    cur += ch;
  }
  const p = cur.trim(); if (p) out.push(p);
  return out;
};

/* narrative leaves: sentence → semicolon part → guarded-comma item (≥2 → per item, else whole) */
const buildSentenceLeaves = (text) => {
  const leaves = [];
  splitBySentence(text).forEach(s => {
    splitBySemicolon(s).forEach(part => {
      const items = splitGuardedComma(part);
      if (items.length >= 2) items.forEach(it => leaves.push(it.replace(/[;.]+$/, '').trim()));
      else leaves.push(part.replace(/[;.]+$/, '').trim());
    });
  });
  return leaves;
};

/* ═══════ MAIN COMPONENT ═══════ */
const DoctorsMedicationRecommendationsDocumentPDFTemplate = ({ document: docProp }) => {
  const pick = (r) => r && (r.doctors_medications_recommendations || r.doctors_medication_recommendations);
  let records = [];
  if (Array.isArray(docProp)) {
    const p0 = docProp.length > 0 ? pick(docProp[0]) : null;
    records = (p0 && Array.isArray(p0)) ? p0 : docProp;
  } else if (docProp && pick(docProp)) {
    const p = pick(docProp);
    records = Array.isArray(p) ? p : [p];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  const DOC_TITLE = "Doctor's Medication Recommendations";

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
          <Text style={styles.noDataText}>No medication recommendation data available.</Text>
        </Page>
      </Document>
    );
  }

  const isFlat = isFlatRecord(records[0]);
  const SECTION_TITLES = isFlat ? FLAT_SECTION_TITLES : UNIFIED_SECTION_TITLES;
  const FIELD_LABELS = isFlat ? FLAT_FIELD_LABELS : UNIFIED_FIELD_LABELS;
  const SECTION_FIELDS = isFlat ? FLAT_SECTION_FIELDS : UNIFIED_SECTION_FIELDS;
  const NARRATIVE_FIELDS = isFlat ? FLAT_NARRATIVE_FIELDS : UNIFIED_NARRATIVE_FIELDS;
  const NUMBER_FIELDS = isFlat ? FLAT_NUMBER_FIELDS : UNIFIED_NUMBER_FIELDS;
  const DATE_FIELDS = isFlat ? FLAT_DATE_FIELDS : UNIFIED_DATE_FIELDS;
  const ARRAY_FIELDS = isFlat ? FLAT_ARRAY_FIELDS : UNIFIED_ARRAY_FIELDS;
  const ENUM_FIELDS = isFlat ? FLAT_ENUM_FIELDS : UNIFIED_ENUM_FIELDS;

  const fieldHasVal = (fn, v) => {
    if (NUMBER_FIELDS.includes(fn)) return hasNumber(v);
    if (DATE_FIELDS.includes(fn)) return hasDate(v);
    if (ARRAY_FIELDS.includes(fn)) return hasArray(v);
    return hasString(v);
  };
  const fieldDisplay = (fn, v) => {
    if (DATE_FIELDS.includes(fn)) return fmtDate(v);
    if (ENUM_FIELDS[fn]) return enumCanonical(ENUM_FIELDS[fn], v) || safeString(v);
    return safeString(v);
  };

  /* value rows for a field (mirror JSX copy numbering) → array of {sub?, value?} */
  const fieldRows = (fn, val) => {
    const rows = [];
    if (ARRAY_FIELDS.includes(fn)) {
      const items = (Array.isArray(val) ? val : [val]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
      items.forEach((item, i) => { const p = parseLabel(String(item)); rows.push({ value: `${i + 1}. ${p.value || String(item)}` }); });
    } else if (NARRATIVE_FIELDS.includes(fn)) {
      buildSentenceLeaves(fieldDisplay(fn, val)).forEach((leaf, i) => rows.push({ value: `${i + 1}. ${leaf}` }));
    } else {
      rows.push({ value: `1. ${fieldDisplay(fn, val)}` });
    }
    return rows;
  };

  /* one field = one glue View (anti-orphan). sectionTitle rides on the first present field. */
  const renderField = (record, fn, sid, sectionTitle) => {
    const val = record[fn];
    if (!fieldHasVal(fn, val)) return null;
    const label = FIELD_LABELS[fn] || fn;
    const title = SECTION_TITLES[sid] || '';
    const sl = label.toLowerCase() !== title.toLowerCase(); // single-name rule
    const rows = fieldRows(fn, val);
    return (
      <View key={fn} style={styles.fieldGroup} wrap={false}>
        {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
        {sl ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {rows.map((r, i) => r.sub
          ? <Text key={i} style={styles.fieldLabel}>{r.sub}</Text>
          : <Text key={i} style={styles.fieldValue}>{r.value}</Text>)}
      </View>
    );
  };

  const renderSection = (record, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const present = fields.filter(f => fieldHasVal(f, record[f]));
    if (present.length === 0) return null;
    const title = SECTION_TITLES[sid];
    return present.map((f, i) => renderField(record, f, sid, i === 0 ? title : null));
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`${DOC_TITLE} ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DoctorsMedicationRecommendationsDocumentPDFTemplate;
