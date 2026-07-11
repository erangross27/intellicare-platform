/**
 * CardiologyFollowupReportsPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE only (#000000 titles/borders/values + grayscale, NO color).
 * Collection: cardiology_followup_reports.
 *
 * BOX-FREE (no backgroundColor/border on field/section views; record/section headers = black borders only).
 * Rule #74: each field is ONE wrap-gated <View> (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined),
 * with its sectionTitle as the FIRST child of the first present field's View (anti-orphan — never a sibling).
 * Single-name skip: hide a field label when it equals the section title.
 *
 * FIELDS (25 non-system, 100% coverage):
 *   DATE(1):    date
 *   NUMBER(6):  heartRate, bodyWeight, ejectionFraction, bnpLevel, troponinLevel, inrValue (hide-zero)
 *   OBJECT(2):  lipidPanel, deviceInterrogation (recursive humanized key/value)
 *   ARRAY(2):   edemaLocation, currentMedications (numbered list)
 *   STRING(14): provider, facility, primaryDiagnosis, nyhaClass, ccsFunctionalClass, bloodPressure,
 *               heartRhythm, chestPainCharacteristics, dyspneaSeverity, medicationAdherence,
 *               anticoagulationTherapy, deviceType, ecgInterpretation, nextFollowupInterval
 *               (per-sentence: primaryDiagnosis, chestPainCharacteristics, ecgInterpretation)
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 13, color: '#000000', marginTop: 3 },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#999999', paddingBottom: 2 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: '#999999', paddingBottom: 2 },
  value: { fontSize: 13, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 16, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 11, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'provider': 'Provider Information',
  'visit': 'Visit Information',
  'vitals': 'Vitals',
  'symptoms': 'Symptoms',
  'labs': 'Labs',
  'meds': 'Current Medications',
  'medications': 'Medication Management',
  'device': 'Device & ECG',
  'followUp': 'Follow-Up',
};
const FIELD_LABELS = {
  date: 'Date',
  primaryDiagnosis: 'Primary Diagnosis', provider: 'Provider', facility: 'Facility',
  bloodPressure: 'Blood Pressure', heartRate: 'Heart Rate', heartRhythm: 'Heart Rhythm', bodyWeight: 'Body Weight',
  chestPainCharacteristics: 'Chest Pain', dyspneaSeverity: 'Dyspnea Severity', nyhaClass: 'NYHA Class', ccsFunctionalClass: 'CCS Functional Class', edemaLocation: 'Edema Location',
  ejectionFraction: 'Ejection Fraction', bnpLevel: 'BNP Level', troponinLevel: 'Troponin Level', lipidPanel: 'Lipid Panel', inrValue: 'INR Value',
  currentMedications: 'Current Medications', medicationAdherence: 'Medication Adherence', anticoagulationTherapy: 'Anticoagulation Therapy',
  deviceType: 'Device Type', ecgInterpretation: 'ECG Interpretation', deviceInterrogation: 'Device Interrogation', nextFollowupInterval: 'Next Follow-Up',
};
const SECTION_FIELDS = {
  'provider': ['provider', 'facility'],
  'visit': ['primaryDiagnosis'],
  'vitals': ['bloodPressure', 'heartRate', 'heartRhythm', 'bodyWeight'],
  'symptoms': ['chestPainCharacteristics', 'dyspneaSeverity', 'nyhaClass', 'ccsFunctionalClass', 'edemaLocation'],
  'labs': ['ejectionFraction', 'bnpLevel', 'troponinLevel', 'lipidPanel', 'inrValue'],
  'meds': ['currentMedications'],
  'medications': ['medicationAdherence', 'anticoagulationTherapy'],
  'device': ['deviceType', 'ecgInterpretation', 'deviceInterrogation'],
  'followUp': ['nextFollowupInterval'],
};
const SECTION_ORDER = ['provider', 'visit', 'vitals', 'symptoms', 'labs', 'meds', 'medications', 'device', 'followUp'];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['heartRate', 'bodyWeight', 'ejectionFraction', 'bnpLevel', 'troponinLevel', 'inrValue'];
const OBJECT_FIELDS = ['lipidPanel', 'deviceInterrogation'];
const ARRAY_FIELDS = ['edemaLocation', 'currentMedications'];
const SENTENCE_FIELDS = ['primaryDiagnosis', 'chestPainCharacteristics', 'ecgInterpretation'];

const KEY_OVERRIDES = {
  ldl: 'LDL', hdl: 'HDL', vldl: 'VLDL', bnp: 'BNP', inr: 'INR', ef: 'EF', lvef: 'LVEF',
  ntprobnp: 'NT-proBNP', icd: 'ICD', crt: 'CRT', ppm: 'PPM', bpm: 'BPM', ecg: 'ECG', egfr: 'eGFR',
};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const lower = String(key).toLowerCase(); if (KEY_OVERRIDES[lower]) return KEY_OVERRIDES[lower]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const hasNumber = (v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); return Number.isFinite(n) && n !== 0; };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const COMMA_SPLIT_FIELDS = new Set(['ecgInterpretation']);
// Split a list on ", " only — parenthesis-aware.
const splitByComma = (text) => { const s = String(text || ''); const out = []; let cur = '', depth = 0; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); if (ch === ',' && depth === 0 && /\s/.test(s[i + 1] || '')) { const t = cur.trim(); if (t) out.push(t); cur = ''; } else cur += ch; } const t = cur.trim(); if (t) out.push(t); return out; };

/* field presence (mirror JSX hide-zero for numbers) */
const fieldHasVal = (f, v) => (NUMBER_FIELDS.includes(f) ? hasNumber(v) : hasVal(v));

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* Rule #74 (per-field gating): render a field as wrap-gated View(s) — EACH View is one wrap unit.
   sectionTitle goes INSIDE the first View (isFirst) — never a sibling. Returns an ARRAY of Views. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!fieldHasVal(field, val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (NUMBER_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{fmtVal(val)}</Text>
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(field)) {
    const items = (Array.isArray(val) ? val : []).filter(it => !isEmptyDeep(it));
    if (items.length === 0) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={items.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => (<Text key={i} style={styles.value}>{i + 1}. {fmtVal(it)}</Text>))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${field}-${k}`, 1)}
        </View>
      );
    });
  }

  /* string — per-sentence split for narrative fields */
  const strVal = fmtVal(val);
  if (COMMA_SPLIT_FIELDS.has(field)) {
    const items = []; splitBySentence(strVal).forEach(sent => splitByComma(sent).forEach(p => items.push(p)));
    return [(
      <View key={field} style={styles.fieldGroup} wrap={items.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((s, i) => (<Text key={i} style={styles.value}>{i + 1}. {s}</Text>))}
      </View>
    )];
  }
  const sentences = SENTENCE_FIELDS.includes(field) ? splitBySentence(strVal) : [strVal];
  if (sentences.length > 1) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={sentences.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.value}>{sIdx + 1}. {s}</Text>))}
      </View>
    )];
  }
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>{strVal}</Text>
    </View>
  )];
};

const CardiologyFollowupReportsPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.cardiology_followup_reports) records = Array.isArray(data[0].cardiology_followup_reports) ? data[0].cardiology_followup_reports : [data[0].cardiology_followup_reports];
    else records = data;
  } else if (data?.cardiology_followup_reports) records = Array.isArray(data.cardiology_followup_reports) ? data.cardiology_followup_reports : [data.cardiology_followup_reports];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.cardiology_followup_reports) records = Array.isArray(dd.cardiology_followup_reports) ? dd.cardiology_followup_reports : [dd.cardiology_followup_reports]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="A4" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Cardiology Follow-Up Reports</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Cardiology Follow-Up Reports</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Cardiology Follow-Up ${idx + 1}`}</Text>
              {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>

            {/* Rule #74 (per-field gating): section View only provides spacing and always FLOWS.
                Each field is its own wrap-gated unit (via renderField), with the sectionTitle embedded
                INSIDE the first present field's View (anti-orphan). */}
            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => fieldHasVal(f, record[f]));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid} style={styles.section}>
                  {presentFields.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default CardiologyFollowupReportsPDFTemplate;
