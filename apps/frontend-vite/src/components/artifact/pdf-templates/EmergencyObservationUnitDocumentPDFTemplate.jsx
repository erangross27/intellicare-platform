/**
 * EmergencyObservationUnitDocumentPDFTemplate.jsx
 * Box-free — Helvetica — LETTER — BLACK & WHITE ONLY (#000000/#333333/#999999/#cccccc). Collection: emergency_observation_unit.
 *
 * Rule #74 page-break (memory 6a4cb19d / ChiropracticConsultation renderFieldUnit):
 *   - section = a PLAIN <View> (no wrap);
 *   - each field is its OWN flattened wrap-gated View (wrap={rows > 22 ? true : false});
 *   - the sectionTitle rides INSIDE the FIRST present field's View (isFirst) — never a standalone sibling;
 *   - recordContainer paddingBottom ONLY; only recordHeader is unconditionally wrap={false}.
 *
 * Field handling mirrors the JSX SECTION_FIELDS:
 *   DATE → formatted · DATETIME (admission/discharge) → date + time · NUMBER/BOOLEAN/SCALAR → value
 *   ARRAY → numbered list · SENTENCE → splitBySentence[.;] + labeled comma rows
 *   OBJECT (vitalSignsOnArrival) → DYNAMIC Object.entries (humanizeKey) — NEVER a hardcoded key list
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', textAlign: 'center' },
  recordContainer: { paddingBottom: 16 },  // paddingBottom ONLY — marginBottom shoves the whole record to the next page (Rule #74)
  recordHeader: { marginBottom: 14 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordMeta: { fontSize: 11, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#333333', borderTopWidth: 0.5, borderTopColor: '#999999', borderTopStyle: 'solid', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'admission-info': 'Admission Information',
  'vitals-arrival': 'Vital Signs on Arrival',
  'serial-vitals': 'Serial Vital Signs',
  'observation-protocol': 'Observation Protocol',
  'cardiac-workup': 'Cardiac Workup',
  'neuro-pain': 'Neurological & Pain',
  'fluid-balance': 'Fluid Balance',
  'diagnostics-treatment': 'Diagnostics & Treatment',
  'response-disposition': 'Response & Disposition',
  'discharge-details': 'Discharge Details',
  'followup-consults': 'Follow-up & Consulting',
};
const SECTION_ORDER = ['admission-info', 'vitals-arrival', 'serial-vitals', 'observation-protocol', 'cardiac-workup', 'neuro-pain', 'fluid-balance', 'diagnostics-treatment', 'response-disposition', 'discharge-details', 'followup-consults'];
const SECTION_FIELDS = {
  'admission-info': ['date', 'chiefComplaint', 'triageCategory', 'admissionTime', 'dischargeTime', 'lengthOfStay'],
  'vitals-arrival': ['vitalSignsOnArrival'],
  'serial-vitals': ['serialVitalSigns'],
  'observation-protocol': ['observationProtocol', 'cardiovascularMonitoring'],
  'cardiac-workup': ['serialTroponins', 'serialEcgs'],
  'neuro-pain': ['neurologicalChecks', 'painReassessments'],
  'fluid-balance': ['fluidBalance'],
  'diagnostics-treatment': ['diagnosticTestsOrdered', 'treatmentInterventions'],
  'response-disposition': ['responseToTreatment', 'conversionToInpatient', 'dischargeDisposition'],
  'discharge-details': ['dischargeDiagnosis', 'dischargeInstructions', 'prescriptionsGiven'],
  'followup-consults': ['followUpArrangements', 'returnPrecautions', 'consultingServices'],
};
const FIELD_LABELS = {
  date: 'Date', chiefComplaint: 'Chief Complaint', triageCategory: 'Triage Category',
  admissionTime: 'Admission Time', dischargeTime: 'Discharge Time', lengthOfStay: 'Length of Stay (hours)',
  vitalSignsOnArrival: 'Vital Signs on Arrival', serialVitalSigns: 'Serial Vital Signs',
  observationProtocol: 'Observation Protocol', cardiovascularMonitoring: 'Cardiovascular Monitoring',
  serialTroponins: 'Serial Troponins', serialEcgs: 'Serial ECGs', neurologicalChecks: 'Neurological Checks',
  painReassessments: 'Pain Reassessments', fluidBalance: 'Fluid Balance',
  diagnosticTestsOrdered: 'Diagnostic Tests Ordered', treatmentInterventions: 'Treatment Interventions',
  responseToTreatment: 'Response to Treatment', conversionToInpatient: 'Conversion to Inpatient',
  dischargeDisposition: 'Discharge Disposition', dischargeDiagnosis: 'Discharge Diagnosis',
  dischargeInstructions: 'Discharge Instructions', prescriptionsGiven: 'Prescriptions Given',
  followUpArrangements: 'Follow-up Arrangements', returnPrecautions: 'Return Precautions',
  consultingServices: 'Consulting Services',
};
const DATE_FIELDS = ['date'];
const DATETIME_FIELDS = ['admissionTime', 'dischargeTime'];
const NUMBER_FIELDS = ['lengthOfStay'];
const BOOLEAN_FIELDS = ['cardiovascularMonitoring', 'conversionToInpatient'];
const SENTENCE_FIELDS = ['responseToTreatment', 'dischargeDiagnosis', 'dischargeInstructions', 'followUpArrangements', 'returnPrecautions'];
const ARRAY_FIELDS = ['serialVitalSigns', 'serialTroponins', 'serialEcgs', 'neurologicalChecks', 'painReassessments', 'diagnosticTestsOrdered', 'treatmentInterventions', 'prescriptionsGiven', 'consultingServices'];
const OBJECT_FIELDS = ['vitalSignsOnArrival', 'fluidBalance'];

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->')
    .replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'")
    .replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isEmptyDate = (v) => {
  if (isEmptyDeep(v)) return true;
  const d = new Date(v.$date || v);
  return isNaN(d.getTime()) || d.getUTCFullYear() <= 1970;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fieldHasVal = (fn, v) => (DATE_FIELDS.includes(fn) || DATETIME_FIELDS.includes(fn)) ? !isEmptyDate(v) : !isEmptyDeep(v);

const KEY_OVERRIDES = { spo2: 'SpO2', bp: 'Blood Pressure', hr: 'Heart Rate', rr: 'Respiratory Rate' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* asUTCDate: wall-clock parse (tz-independent) */
const asUTCDate = (v) => {
  const s = String(v?.$date || v || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) { const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
  return { d: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0))), hasTime: m[4] !== undefined };
};
const formatDate = (v) => { const r = asUTCDate(v); if (!r || !r.d) return safeString(v); return r.d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); };
const formatDateTime = (v) => {
  const r = asUTCDate(v); if (!r || !r.d) return safeString(v);
  const datePart = r.d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  if (!r.hasTime) return datePart;
  return `${datePart}, ${r.d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })}`;
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
/* parseTimeLabel: clock-time array item "HH:MM AM/PM [(...)]: value" (label starts with a digit → parseLabel misses it) */
const parseTimeLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^(\d{1,2}:\d{2}\s*[AP]M(?:\s*\([^)]*\))?):\s+([\s\S]+)$/i);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/)
    // a leading conditional clause's colon is grammatical, not a Label:Value delimiter — drop it (memory 6a4cb55c)
    .map(s => s.trim().replace(/^((?:If|When|While|Unless|Until|Once|Whenever|Should|In case|As needed)\b[^:]{0,60}?):\s+/i, '$1 '))
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) { const t = cur.trim(); if (t) out.push(t); cur = ''; }
    else cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : [text];
};

/* sentence field → [{type:'subtitle'|'item', text, num}] rows (numbered, labeled clause → subtitle + comma rows) */
const sentenceRows = (text) => {
  const rows = []; let n = 1;
  splitBySentence(fmtScalar(text)).forEach(s => {
    const p = parseLabel(s);
    const commaItems = p.isLabeled ? splitByComma(p.value) : null;
    if (p.isLabeled && commaItems.length >= 2) {
      rows.push({ type: 'subtitle', text: safeString(p.label) });
      commaItems.forEach(ci => rows.push({ type: 'item', text: safeString(ci), num: n++ }));
    } else {
      rows.push({ type: 'item', text: safeString(s.replace(/[;.]+$/, '').trim()), num: n++ });
    }
  });
  return rows;
};

/* rows a field contributes — drives the per-field wrap threshold */
const fieldRowCount = (record, fn) => {
  const val = record[fn];
  if (ARRAY_FIELDS.includes(fn)) return 1 + (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x)).reduce((n, item) => { const p = parseTimeLabel(String(item)); return n + (p.isLabeled ? 1 + splitByComma(p.value).length : 1); }, 0);
  if (SENTENCE_FIELDS.includes(fn)) return 1 + Math.max(1, sentenceRows(val).length);
  if (OBJECT_FIELDS.includes(fn) && val && typeof val === 'object') return 1 + Object.values(val).filter(v => !isEmptyDeep(v)).length * 2;
  return 2;  // label + value
};

/* ======= RENDER FIELD — ONE flattened wrap-gated View; sectionTitle inside the FIRST present field ======= */
const renderField = (record, fn, sectionTitle, isFirst, key) => {
  const val = record[fn];
  if (!fieldHasVal(fn, val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const rows = fieldRowCount(record, fn) + (isFirst ? 1 : 0);

  let body;
  if (DATE_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>{formatDate(val)}</Text>;
  } else if (DATETIME_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>{formatDateTime(val)}</Text>;
  } else if (BOOLEAN_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>;
  } else if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    body = items.map((item, i) => {
      const p = parseTimeLabel(String(item));
      if (p.isLabeled) {
        // "Time: a, b, c" → time sub-label + numbered comma leaves
        const leaves = splitByComma(p.value);
        return (
          <View key={i}>
            <Text style={styles.subLabel}>{safeString(p.label)}</Text>
            {leaves.map((leaf, li) => <Text key={li} style={styles.listItem}>{li + 1}. {safeString(leaf)}</Text>)}
          </View>
        );
      }
      return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(String(item))}</Text>;
    });
  } else if (SENTENCE_FIELDS.includes(fn)) {
    body = sentenceRows(val).map((r, i) => r.type === 'subtitle'
      ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
      : <Text key={i} style={styles.listItem}>{r.num}. {r.text}</Text>);
  } else if (OBJECT_FIELDS.includes(fn) && val && typeof val === 'object') {
    // DYNAMIC keys — render whatever the record actually holds (never a hardcoded abbreviation list)
    body = Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).map(([k, v], i) => (
      <View key={i} style={{ marginBottom: 3 }}>
        <Text style={styles.subLabel}>{humanizeKey(k)}</Text>
        <Text style={styles.fieldValue}>{isScalar(v) ? safeString(fmtScalar(v)) : safeString(Object.entries(v).map(([kk, vv]) => `${humanizeKey(kk)}: ${fmtScalar(vv)}`).join('; '))}</Text>
      </View>
    ));
  } else {
    body = <Text style={styles.fieldValue}>{safeString(fmtScalar(val))}</Text>;
  }

  return (
    <View key={key} style={styles.fieldBox} wrap={rows > 22 ? true : false}>
      {isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {body}
    </View>
  );
};

/* ======= RENDER SECTION — plain breakable View; title rides inside the first present field ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => fieldHasVal(f, record[f]));
  if (presentFields.length === 0) return null;
  return (
    <View key={sid} style={styles.section}>
      {presentFields.map((f, i) => renderField(record, f, title, i === 0, `${sid}-${f}`))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const EmergencyObservationUnitDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.emergency_observation_unit) return Array.isArray(r.emergency_observation_unit) ? r.emergency_observation_unit : [r.emergency_observation_unit];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.emergency_observation_unit) return Array.isArray(dd.emergency_observation_unit) ? dd.emergency_observation_unit : [dd.emergency_observation_unit]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Emergency Observation Unit</Text></View>
          <Text style={styles.noDataText}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Emergency Observation Unit</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Emergency Observation Unit ${idx + 1}`}</Text>
              {!isEmptyDate(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default EmergencyObservationUnitDocumentPDFTemplate;
