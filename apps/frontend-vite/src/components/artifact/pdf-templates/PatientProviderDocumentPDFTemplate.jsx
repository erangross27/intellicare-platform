/**
 * PatientProviderDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical) - mirrors the JSX field-for-field: date as a real record field
 * (never createdAt/updatedAt), arrays as numbered items, objects rendered recursively (sub-label
 * above value, stacked), numbers hide-zero, sentences split on [.;]. Multi-record: each record
 * breaks to a new page. Rule #74: each field is ONE wrap={false} atomic View with the sectionTitle
 * riding INSIDE the first field's View. safeString uses ONLY \uXXXX escapes. Static PHI footer.
 * Collection: patient_provider
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

/* CONFIG (mirrors the JSX exactly) */
const SECTION_ORDER = ['provider-info', 'encounter-info', 'chief-complaint', 'chronic-conditions', 'vital-signs', 'procedures', 'diagnostic-orders', 'medications', 'prescriptions', 'referrals', 'education', 'follow-up', 'immunizations', 'billing', 'signature'];
const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'encounter-info': 'Encounter Information',
  'chief-complaint': 'Chief Complaint',
  'chronic-conditions': 'Chronic Conditions Addressed',
  'vital-signs': 'Vital Signs Recorded',
  'procedures': 'Procedures Performed',
  'diagnostic-orders': 'Diagnostic Orders Placed',
  'medications': 'Medications Reviewed',
  'prescriptions': 'Prescriptions Written',
  'referrals': 'Referrals Issued',
  'education': 'Patient Education Provided',
  'follow-up': 'Follow-Up Interval',
  'immunizations': 'Immunizations Administered',
  'billing': 'Billing Codes',
  'signature': 'Provider Signature',
};
const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider Name',
  providerSpecialty: 'Specialty',
  facility: 'Facility',
  providerNpi: 'NPI',
  providerRole: 'Role',
  providerTaxonomy: 'Taxonomy',
  supervisingProvider: 'Supervising Provider',
  referringProvider: 'Referring Provider',
  encounterType: 'Encounter Type',
  encounterLocation: 'Location',
  visitDuration: 'Visit Duration',
  chiefComplaint: 'Chief Complaint',
  chronicConditionsAddressed: 'Chronic Conditions Addressed',
  vitalSignsRecorded: 'Vital Signs Recorded',
  proceduresPerformed: 'Procedures Performed',
  diagnosticOrdersPlaced: 'Diagnostic Orders Placed',
  medicationsReviewed: 'Medications Reviewed',
  prescriptionsWritten: 'Prescriptions Written',
  referralsIssued: 'Referrals Issued',
  patientEducationProvided: 'Patient Education Provided',
  followUpInterval: 'Follow-Up Interval',
  immunizationsAdministered: 'Immunizations Administered',
  billingCodes: 'Billing Codes',
  providerSignature: 'Provider Signature',
};
const SECTION_FIELDS = {
  'provider-info': ['provider', 'providerSpecialty', 'facility', 'providerNpi', 'providerRole', 'providerTaxonomy', 'supervisingProvider', 'referringProvider'],
  'encounter-info': ['encounterType', 'encounterLocation', 'visitDuration'],
  'chief-complaint': ['chiefComplaint'],
  'chronic-conditions': ['chronicConditionsAddressed'],
  'vital-signs': ['vitalSignsRecorded'],
  'procedures': ['proceduresPerformed'],
  'diagnostic-orders': ['diagnosticOrdersPlaced'],
  'medications': ['medicationsReviewed'],
  'prescriptions': ['prescriptionsWritten'],
  'referrals': ['referralsIssued'],
  'education': ['patientEducationProvided'],
  'follow-up': ['followUpInterval'],
  'immunizations': ['immunizationsAdministered'],
  'billing': ['billingCodes'],
  'signature': ['providerSignature'],
};
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['visitDuration'];
const ARRAY_FIELDS = ['chronicConditionsAddressed', 'proceduresPerformed', 'diagnosticOrdersPlaced', 'medicationsReviewed', 'prescriptionsWritten', 'referralsIssued', 'patientEducationProvided', 'immunizationsAdministered', 'billingCodes'];
const OBJECT_FIELDS = ['vitalSignsRecorded'];
const SENTENCE_FIELDS = ['chiefComplaint'];

const KEY_OVERRIDES = {
  bp: 'BP', hr: 'HR', rr: 'RR', spo2: 'SpO2', temp: 'Temp', bmi: 'BMI',
  o2: 'O2', o2sat: 'O2 Sat', map: 'MAP',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const lk = String(key).toLowerCase();
  if (KEY_OVERRIDES[lk]) return KEY_OVERRIDES[lk];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* HELPERS (mirror the JSX) */
const formatDate = (d) => {
  if (!d) return '';
  try {
    const dt = new Date(d.$date || d);
    if (isNaN(dt.getTime())) return String(d);
    const year = dt.getFullYear();
    if (year <= 1970) return ''; // epoch sentinel = not set
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d); }
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

/* safeString: normalize common non-ASCII glyphs to ASCII. Regex uses ONLY \uXXXX escapes -
   never paste a literal smart-quote / em-dash / BOM into this source. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00B5\u03BC]m/g, 'um')
    .replace(/[\u00B5\u03BC]g/g, 'mcg')
    .replace(/[\u00B5\u03BC]/g, 'u')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->')
    .replace(/[\u00D7\u2715\u2716]/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

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

const sentenceRows = (text) => {
  const strip = (x) => String(x).replace(/[;.]+$/, '').trim();
  const rows = []; let n = 1;
  splitBySentence(text).forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = parts.length >= 2 ? parts : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(strip(it)), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

/* renderObjectBody: recursive object -> array of Text nodes (subLabel above value, stacked) */
const renderObjectBody = (obj) => {
  if (isEmptyDeep(obj)) return [];
  if (isScalar(obj)) return [<Text style={styles.value}>1. {safeString(fmtScalar(obj))}</Text>];
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  const nodes = [];
  entries.forEach(([k, v]) => {
    if (isScalar(v)) {
      nodes.push(<Text key={k + '-l'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      nodes.push(<Text key={k + '-v'} style={styles.value}>1. {safeString(fmtScalar(v))}</Text>);
    } else {
      nodes.push(<Text key={k + '-l'} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
      nodes.push(...renderObjectBody(v));
    }
  });
  return nodes;
};

/* Rule #74: render a field as ONE wrap={false} atomic View; sectionTitle rides inside the first View. */
const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(formatDate(val))}</Text>;
  } else if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(fmtScalar(val))}</Text>;
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : []).filter(it => hasVal(it));
    body = items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>);
  } else if (OBJECT_FIELDS.includes(f)) {
    body = renderObjectBody(val);
  } else if (SENTENCE_FIELDS.includes(f)) {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  } else {
    body = <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {body}
    </View>
  )];
};

const PatientProviderDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].patient_provider && Array.isArray(templateData[0].patient_provider)) records = templateData[0].patient_provider;
    else records = templateData;
  } else if (templateData && templateData.patient_provider) {
    records = Array.isArray(templateData.patient_provider) ? templateData.patient_provider : [templateData.patient_provider];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.patient_provider ? (Array.isArray(dd.patient_provider) ? dd.patient_provider : [dd.patient_provider]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Patient Provider</Text></View>
        <Text style={styles.emptyState}>No patient provider data available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Patient Provider</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Patient Provider ${idx + 1}`}</Text>
            {hasVal(record.date) && (
              <View style={styles.fieldGroup} wrap={false}>
                <Text style={styles.fieldLabel}>Date</Text>
                <Text style={styles.value}>1. {safeString(formatDate(record.date))}</Text>
              </View>
            )}
            {SECTION_ORDER.map((sid) => {
              const title = SECTION_TITLES[sid];
              const fields = SECTION_FIELDS[sid] || [];
              const vis = fields.filter(f => hasVal(record[f]));
              const hasScalarField = fields.some(f => !ARRAY_FIELDS.includes(f) && !OBJECT_FIELDS.includes(f));
              // Skip empty array/object-only sections; always render scalar-field sections (parity with Copy All).
              if (vis.length === 0 && !hasScalarField) return null;
              if (vis.length === 0) {
                return (
                  <View key={sid} style={styles.section}>
                    <View style={styles.fieldGroup} wrap={false}>
                      <Text style={styles.sectionTitle}>{safeString(title)}</Text>
                    </View>
                  </View>
                );
              }
              return (
                <View key={sid} style={styles.section}>
                  {vis.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default PatientProviderDocumentPDFTemplate;