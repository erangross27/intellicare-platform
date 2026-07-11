/**
 * EmergencyInformationDocumentPDFTemplate.jsx
 * Box-free — Helvetica — LETTER — BLACK & WHITE ONLY (#000000/#333333/#999999/#cccccc). Collection: emergency_information.
 *
 * Rule #74 page-break (memory 6a4cb19d / ChiropracticConsultation renderFieldUnit):
 *   - section = a PLAIN <View> (no wrap);
 *   - each field is its OWN flattened wrap-gated View (wrap={rows > 22 ? true : false});
 *   - the sectionTitle rides INSIDE the FIRST present field's View (isFirst) — never a standalone sibling;
 *   - recordContainer paddingBottom ONLY (never marginBottom); only recordHeader is unconditionally wrap={false}.
 *
 * Field handling mirrors the JSX:
 *   DATE → formatted value · SIMPLE STRINGS → plain value · NARRATIVE → numbered sentences (multi-sentence)
 *   ARRAYS OF STRINGS → numbered list · ARRAY OF OBJECTS → each contact a sub-block (head + sub-label/value lines)
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
  contactValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 1, paddingLeft: 8 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  contacts: 'Emergency Contacts',
  numbers: 'Contact Numbers',
  provider: 'Provider & Facility',
  whentocall: 'When to Call',
  warning: 'Warning Criteria',
  findings: 'Findings & Assessment',
  plan: 'Plan & Recommendations',
};
const SECTION_ORDER = ['contacts', 'numbers', 'provider', 'whentocall', 'warning', 'findings', 'plan'];
const FIELD_LABELS = {
  emergencyContacts: 'Emergency Contacts',
  officePhone: 'Office Phone',
  afterHoursPhone: 'After-Hours Phone',
  provider: 'Provider',
  facility: 'Facility',
  type: 'Type',
  status: 'Status',
  date: 'Date',
  whenToCall: 'When to Call',
  warningCriteria: 'Warning Criteria',
  findings: 'Findings',
  assessment: 'Assessment',
  results: 'Results',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};
const SECTION_FIELDS = {
  contacts: ['emergencyContacts'],
  numbers: ['officePhone', 'afterHoursPhone'],
  provider: ['provider', 'facility', 'type', 'status', 'date'],
  whentocall: ['whenToCall'],
  warning: ['warningCriteria'],
  findings: ['findings', 'assessment', 'results'],
  plan: ['plan', 'recommendations', 'notes'],
};
const DATE_FIELDS = ['date'];
const NARRATIVE_STRING_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const ARRAY_FIELDS = ['whenToCall', 'warningCriteria', 'recommendations'];
const OBJECT_ARRAY_FIELDS = ['emergencyContacts'];

/* ======= UTILS ======= */
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isEmptyDate = (v) => {
  if (isEmptyDeep(v)) return true;
  const d = new Date(v.$date || v);
  if (isNaN(d.getTime())) return true;
  if (d.getTime() <= 0 || d.getUTCFullYear() <= 1970) return true;
  return false;
};
const fieldHasVal = (fn, v) => DATE_FIELDS.includes(fn) ? !isEmptyDate(v) : !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};
const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const formatDate = (d) => { if (isEmptyDate(d)) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return safeString(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return safeString(d); } };

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)|;\s+/)
    // A leading conditional clause's colon is grammatical, not a Label:Value delimiter — drop it (memory 6a4cb55c).
    .map(s => s.trim().replace(/^((?:If|When|While|Unless|Until|Once|Whenever|Should|In case|As needed)\b[^:]{0,60}?):\s+/i, '$1 '))
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* rows a field contributes (label + value rows) — drives the per-field wrap threshold */
const fieldRowCount = (record, fn) => {
  const val = record[fn];
  if (OBJECT_ARRAY_FIELDS.includes(fn)) {
    const arr = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    return 1 + arr.reduce((n, item) => n + (isScalar(item) ? 1 : Object.values(item).filter(v => !isEmptyDeep(v)).length + 1), 0);
  }
  if (ARRAY_FIELDS.includes(fn)) {
    return 1 + (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x)).length;
  }
  if (NARRATIVE_STRING_FIELDS.includes(fn)) {
    return 1 + Math.max(1, splitBySentence(safeString(val)).length);
  }
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
  } else if (OBJECT_ARRAY_FIELDS.includes(fn)) {
    const arr = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    body = arr.map((item, i) => {
      if (isScalar(item)) return <Text key={i} style={styles.contactValue}>{safeString(item)}</Text>;
      const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
      if (entries.length === 0) return null;
      const headScalar = isScalar(entries[0][1]);
      const rest = headScalar ? entries.slice(1) : entries;
      return (
        <View key={i} style={{ marginBottom: 4 }}>
          {headScalar ? <Text style={styles.subLabel}>{safeString(entries[0][1])}</Text> : null}
          {rest.map(([k, v]) => (
            <Text key={k} style={styles.contactValue}>{humanizeKey(k)}: {safeString(v)}</Text>
          ))}
        </View>
      );
    });
  } else if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    body = items.map((item, i) => {
      const p = parseLabel(String(item));
      return <Text key={i} style={styles.listItem}>{i + 1}. {p.value || String(item)}</Text>;
    });
  } else if (NARRATIVE_STRING_FIELDS.includes(fn)) {
    const strVal = safeString(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1) {
      body = sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/[;.]+$/, '').trim()}</Text>);
    } else {
      body = <Text style={styles.fieldValue}>{strVal}</Text>;
    }
  } else {
    body = <Text style={styles.fieldValue}>{safeString(val)}</Text>;
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
const EmergencyInformationDocumentPDFTemplate = ({ document: docProp }) => {
  const pick = (r) => r && r.emergency_information;
  let records = [];
  if (Array.isArray(docProp)) {
    const p0 = docProp.length > 0 ? pick(docProp[0]) : null;
    if (p0 && Array.isArray(p0)) records = p0;
    else records = docProp;
  } else if (docProp && pick(docProp)) {
    const p = pick(docProp);
    records = Array.isArray(p) ? p : [p];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Emergency Information</Text>
          </View>
          <Text style={styles.noDataText}>No emergency information data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Emergency Information</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Emergency Information ${idx + 1}`}</Text>
              {!isEmptyDate(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default EmergencyInformationDocumentPDFTemplate;
