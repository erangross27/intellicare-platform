/**
 * CareCoordinationNotesDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — black & white only (#000000)
 * Collection: care_coordination_notes
 *
 * Field handling mirrors the JSX:
 *   - Numbers (glasgowComaScale, estimatedGfr) → numeric presence (0/absent hidden, NEVER truthiness)
 *   - Arrays  → numbered list items
 *   - Sentence narratives → splitBySentence → numbered list items
 *   - Short strings → single value
 * Rule #74: section title kept with first content via conditional wrap.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  fieldBox: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2, marginTop: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2, marginTop: 4, paddingLeft: 8 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ═══════ FIELD CONFIG (mirror JSX) ═══════ */
const SECTION_TITLES = {
  'referral': 'Referral',
  'diagnosis': 'Diagnosis',
  'comorbidities': 'Comorbidities',
  'allergies': 'Allergies & Contraindications',
  'vitals': 'Vitals & Labs',
  'medications': 'Medication Reconciliation',
  'meds': 'Current Medications',
  'imaging': 'Imaging Studies',
  'functional': 'Functional Status',
  'social': 'Social Determinants',
  'barriers': 'Barriers to Care',
  'goals': 'Care Goals',
  'risks': 'Risk Factors',
  'team': 'Care Team',
  'followUp': 'Follow-Up Appointments',
  'discharge': 'Discharge Instructions',
  'transition': 'Transition of Care',
  'advance': 'Advance Directives',
};

const FIELD_LABELS = {
  referringProvider: 'Referring Provider',
  consultingSpecialty: 'Consulting Specialty',
  patientMrn: 'Patient MRN',
  primaryDiagnosis: 'Primary Diagnosis',
  comorbidities: 'Comorbidities',
  allergiesContraindications: 'Allergies & Contraindications',
  vitalSigns: 'Vital Signs',
  glasgowComaScale: 'Glasgow Coma Scale',
  laboratorySummary: 'Laboratory Summary',
  estimatedGfr: 'eGFR',
  nyhaClassification: 'NYHA Classification',
  currentMedications: 'Current Medications',
  medicationReconciliation: 'Medication Reconciliation',
  imagingStudies: 'Imaging Studies',
  functionalStatus: 'Functional Status',
  socialDeterminants: 'Social Determinants',
  barriersToCare: 'Barriers to Care',
  careGoals: 'Care Goals',
  riskFactors: 'Risk Factors',
  careTeamMembers: 'Care Team Members',
  followUpAppointments: 'Follow-Up Appointments',
  dischargeInstructions: 'Discharge Instructions',
  transitionOfCare: 'Transition of Care',
  advanceDirectives: 'Advance Directives',
};

const SECTION_FIELDS = {
  'referral': ['referringProvider', 'consultingSpecialty', 'patientMrn'],
  'diagnosis': ['primaryDiagnosis'],
  'comorbidities': ['comorbidities'],
  'allergies': ['allergiesContraindications'],
  'vitals': ['vitalSigns', 'glasgowComaScale', 'laboratorySummary', 'estimatedGfr', 'nyhaClassification'],
  'medications': ['medicationReconciliation'],
  'meds': ['currentMedications'],
  'imaging': ['imagingStudies'],
  'functional': ['functionalStatus'],
  'social': ['socialDeterminants'],
  'barriers': ['barriersToCare'],
  'goals': ['careGoals'],
  'risks': ['riskFactors'],
  'team': ['careTeamMembers'],
  'followUp': ['followUpAppointments'],
  'discharge': ['dischargeInstructions'],
  'transition': ['transitionOfCare'],
  'advance': ['advanceDirectives'],
};

const NUMBER_FIELDS = ['glasgowComaScale', 'estimatedGfr'];
const ARRAY_FIELDS = ['comorbidities', 'currentMedications', 'allergiesContraindications', 'imagingStudies', 'followUpAppointments', 'careGoals', 'riskFactors', 'careTeamMembers', 'barriersToCare'];
const SENTENCE_FIELDS = ['primaryDiagnosis', 'laboratorySummary', 'functionalStatus', 'dischargeInstructions', 'medicationReconciliation', 'socialDeterminants', 'transitionOfCare', 'advanceDirectives'];

/* ═══════ UTILS ═══════ */
const hasNumber = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return !isNaN(n) && n !== 0;
};

const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
};

const fieldHasVal = (fn, v) => {
  if (NUMBER_FIELDS.includes(fn)) return hasNumber(v);
  if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(Boolean).length > 0;
  return hasString(v);
};

const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[;.](?:\s+)/)
    .map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* parseLabel: detect "Label: value" patterns (mirror JSX) */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: top-level commas only — NOT inside parentheses, NOT when "and"/"or" sits
   right before or right after the comma, NOT without a following space ("$18,000") (mirror JSX) */
const splitByComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      if (!/\s/.test(s[i + 1] || '')) { cur += ch; continue; }
      const rest = s.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\b(and|or)\s*$/i.test(cur)) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : (s.trim() ? [s.trim()] : []);
};

/* sentence fields: split by sentence FIRST, then by comma; a labeled sentence keeps its
   label on EVERY comma part so all parts group under one sub-label (mirror JSX) */
const buildSentenceEntries = (text) => {
  const entries = [];
  splitBySentence(text).forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) splitByComma(p.value).forEach(part => entries.push({ text: part, label: p.label }));
    else splitByComma(sentence).forEach(part => entries.push({ text: part, label: null }));
  });
  return entries;
};

/* array items → entries [{text, label}] via parseLabel */
const toLabeledEntries = (items) => items.map(it => {
  const s = safeString(it);
  const p = parseLabel(s);
  return p.isLabeled ? { text: p.value, label: p.label } : { text: s, label: null };
});

/* entries → bold sub-label once per consecutive group, values numbered and indented
   below — never side-by-side "Label: value" (memory 699dc18f) */
const buildGroupedRows = (entries) => {
  const rows = [];
  let prevGroupLabel = null, groupNum = 0, plainNum = 0;
  entries.forEach(e => {
    if (e.label) {
      if (e.label !== prevGroupLabel) { rows.push({ kind: 'sub', text: e.label }); groupNum = 0; }
      groupNum += 1;
      rows.push({ kind: 'item', text: `${groupNum}. ${e.text}`, indent: true });
      prevGroupLabel = e.label;
    } else {
      plainNum += 1;
      rows.push({ kind: 'item', text: `${plainNum}. ${e.text}` });
      prevGroupLabel = null;
    }
  });
  return rows;
};

/* ═══════ RENDER FIELD ═══════ */
/* hideLabel: single-field sections skip the field label — the section title already names it (Rule #47) */
const renderField = (record, fn, hideLabel) => {
  const val = record[fn];
  if (!fieldHasVal(fn, val)) return null;
  const label = FIELD_LABELS[fn] || fn;

  if (NUMBER_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={{ marginBottom: 4 }}>
        {!hideLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{safeString(val)}</Text>
      </View>
    );
  }

  const renderGroupedRows = (rows) => rows.map((r, i) => r.kind === 'sub'
    ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
    : <Text key={i} style={[styles.listItem, r.indent ? { paddingLeft: 16 } : null]}>{r.text}</Text>);

  if (ARRAY_FIELDS.includes(fn)) {
    const items = safeArr(val);
    return (
      <View key={fn} style={{ marginBottom: 4 }}>
        {!hideLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {renderGroupedRows(buildGroupedRows(toLabeledEntries(items)))}
      </View>
    );
  }

  if (SENTENCE_FIELDS.includes(fn)) {
    const strVal = safeString(val);
    const entries = buildSentenceEntries(strVal);
    if (entries.length > 1) {
      const cleaned = entries.map(e => ({ text: e.text.replace(/[;.]+$/, '').trim(), label: e.label && e.label.toLowerCase() !== label.toLowerCase() ? e.label : null }));
      return (
        <View key={fn} style={{ marginBottom: 4 }}>
          {!hideLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {renderGroupedRows(buildGroupedRows(cleaned))}
        </View>
      );
    }
    return (
      <View key={fn} style={{ marginBottom: 4 }}>
        {!hideLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{strVal}</Text>
      </View>
    );
  }

  /* Short string */
  return (
    <View key={fn} style={{ marginBottom: 4 }}>
      {!hideLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(val)}</Text>
    </View>
  );
};

/* row count for a field — drives Rule #74 wrap gating */
const fieldRowCount = (record, fn) => {
  const val = record[fn];
  if (ARRAY_FIELDS.includes(fn)) return safeArr(val).length;
  if (SENTENCE_FIELDS.includes(fn)) { const s = buildSentenceEntries(safeString(val)); return s.length > 1 ? s.length : 1; }
  return 1;
};

/* ═══════ RENDER SECTION — title kept with content via conditional wrap (Rule #74) ═══════ */
/* Gate on the section's total content rows (label + rows), not field count, so long
   narrative/array fields flow across pages while short sections stay glued intact. */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => fieldHasVal(f, record[f]));
  if (presentFields.length === 0) return null;

  const totalRows = presentFields.reduce((sum, f) => sum + 1 + fieldRowCount(record, f), 0);
  const hideLabel = fields.length === 1; // single-field section: title already names it (Rule #47)

  return (
    <View key={sid} style={styles.fieldBox} wrap={totalRows > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {presentFields.map(f => renderField(record, f, hideLabel))}
    </View>
  );
};

/* ═══════ MAIN COMPONENT ═══════ */
const CareCoordinationNotesDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].care_coordination_notes && Array.isArray(docProp[0].care_coordination_notes)) {
      records = docProp[0].care_coordination_notes;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.care_coordination_notes) {
    records = Array.isArray(docProp.care_coordination_notes) ? docProp.care_coordination_notes : [docProp.care_coordination_notes];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Care Coordination Notes</Text>
          </View>
          <Text style={styles.noDataText}>No care coordination notes data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Care Coordination Notes</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Care Coordination Notes ${idx + 1}`}</Text>
            </View>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CareCoordinationNotesDocumentPDFTemplate;
