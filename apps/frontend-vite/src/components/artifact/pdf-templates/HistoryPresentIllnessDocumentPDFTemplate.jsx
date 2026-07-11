/**
 * HistoryPresentIllnessDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX config exactly:
 * real record.date (never createdAt/updatedAt), DATE_FIELDS via BlueDatePicker parity, NUMBER_FIELDS
 * (numbers incl. 0), ARRAY_FIELDS numbered, additionalData recursive object, LONG_TEXT sentence-split
 * ([.;] with abbrev/single-initial guard + labeled comma-split), values numbered ('1.' even singles),
 * single-name label gate. Rule #74: each field is ONE wrap={false} atomic View with the sectionTitle
 * riding INSIDE the first present field's View. safeString uses ONLY \uXXXX escapes. Static PHI footer.
 * Collection: history_present_illness.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

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
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 0.5, borderLeftColor: '#999999', marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['chief-complaint', 'symptom-timeline', 'pain-assessment', 'associated-symptoms', 'systems-review', 'functional-impact', 'history-context', 'additional-details', 'provider-details', 'clinical-notes'];
const SECTION_TITLES = {
  'chief-complaint': 'Chief Complaint',
  'symptom-timeline': 'Symptom Timeline',
  'pain-assessment': 'Pain Assessment',
  'associated-symptoms': 'Associated Symptoms',
  'systems-review': 'Systems Review',
  'functional-impact': 'Functional Impact',
  'history-context': 'History & Context',
  'additional-details': 'Additional Details',
  'provider-details': 'Provider Details',
  'clinical-notes': 'Clinical Notes',
};
const FIELD_LABELS = {
  chiefComplaint: 'Chief Complaint',
  symptomOnsetDateTime: 'Symptom Onset',
  symptomDurationDays: 'Symptom Duration (days)',
  triggeringEvent: 'Triggering Event',
  symptomProgression: 'Symptom Progression',
  painSeverityScore: 'Pain Severity Score',
  painCharacteristics: 'Pain Characteristics',
  painRadiationPattern: 'Radiation Pattern',
  alleviatingFactors: 'Alleviating Factors',
  aggravatingFactors: 'Aggravating Factors',
  associatedSymptoms: 'Associated Symptoms',
  respiratorySymptoms: 'Respiratory Symptoms',
  gastrointestinalSymptoms: 'Gastrointestinal Symptoms',
  neurologicalSymptoms: 'Neurological Symptoms',
  constitutionalSymptoms: 'Constitutional Symptoms',
  cardiovascularSymptoms: 'Cardiovascular Symptoms',
  functionalImpairmentLevel: 'Functional Impairment Level',
  workActivityLimitations: 'Work/Activity Limitations',
  sleepDisturbances: 'Sleep Disturbances',
  appetiteChanges: 'Appetite Changes',
  previousEpisodeHistory: 'Previous Episode History',
  recentHealthcareContacts: 'Recent Healthcare Contacts',
  currentMedicationEffectiveness: 'Current Medication Effectiveness',
  additionalData: 'Additional Details',
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  notes: 'Notes',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
};
const SECTION_FIELDS = {
  'chief-complaint': ['chiefComplaint'],
  'symptom-timeline': ['symptomOnsetDateTime', 'symptomDurationDays', 'triggeringEvent', 'symptomProgression'],
  'pain-assessment': ['painSeverityScore', 'painCharacteristics', 'painRadiationPattern', 'alleviatingFactors', 'aggravatingFactors'],
  'associated-symptoms': ['associatedSymptoms'],
  'systems-review': ['respiratorySymptoms', 'gastrointestinalSymptoms', 'neurologicalSymptoms', 'constitutionalSymptoms', 'cardiovascularSymptoms'],
  'functional-impact': ['functionalImpairmentLevel', 'workActivityLimitations', 'sleepDisturbances', 'appetiteChanges'],
  'history-context': ['previousEpisodeHistory', 'recentHealthcareContacts', 'currentMedicationEffectiveness'],
  'additional-details': ['additionalData'],
  'provider-details': ['date', 'provider', 'facility'],
  'clinical-notes': ['notes', 'findings', 'assessment', 'plan'],
};
const DATE_FIELDS = ['symptomOnsetDateTime', 'date'];
const NUMBER_FIELDS = ['symptomDurationDays', 'painSeverityScore'];
const ARRAY_FIELDS = ['painCharacteristics', 'alleviatingFactors', 'aggravatingFactors', 'associatedSymptoms', 'respiratorySymptoms', 'gastrointestinalSymptoms', 'neurologicalSymptoms', 'constitutionalSymptoms', 'cardiovascularSymptoms', 'recentHealthcareContacts'];
const OBJECT_FIELDS = ['additionalData'];
const LONG_TEXT_FIELDS = ['chiefComplaint', 'triggeringEvent', 'symptomProgression', 'functionalImpairmentLevel', 'previousEpisodeHistory', 'currentMedicationEffectiveness', 'notes', 'findings', 'assessment', 'plan'];
const NO_SPLIT_FIELDS = [];

const getVal = (obj, path) => { if (!obj || !path) return undefined; return String(path).split('.').reduce((cur, part) => (cur === null || cur === undefined) ? undefined : cur[part], obj); };

const KEY_OVERRIDES = { ef: 'EF', lvef: 'LVEF', bmi: 'BMI', bp: 'BP', hr: 'HR', rr: 'RR', spo2: 'SpO2', ecg: 'ECG', ekg: 'EKG' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  if (/\s/.test(String(key))) return String(key);
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* safeString — \uXXXX escapes ONLY (never literal smart-quotes/invisible chars → Unterminated regex) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
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
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200D\u2028\u2029\uFEFF]/g, '');
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s)); };
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
      if (parts.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        let m = 1;
        parts.forEach(it => {
          const ip = parseLabel(it);
          if (ip.isLabeled) rows.push({ type: 'subtitle', text: safeString(ip.label) });
          rows.push({ type: 'item', text: safeString(strip(ip.isLabeled ? ip.value : it)), num: m++ });
        });
      } else {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        rows.push({ type: 'item', text: safeString(strip(parsed.value)), num: 1 });
      }
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (Array.isArray(value)) {
    const items = value.filter(x => !isEmptyDeep(x));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        {items.map((it, i) => (isScalar(it)
          ? <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>
          : <View key={i} style={styles.nested}>{renderObjectNode('', it, `${keyPath}-${i}`, depth + 1)}</View>))}
      </View>
    );
  }
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>1. {safeString(fmtScalar(value))}</Text>
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

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = getVal(record, f);
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${f}-${k}`, 1))}
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>)}
      </View>
    )];
  }

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(formatDate(val))}</Text>;
  } else if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(fmtScalar(val))}</Text>;
  } else if (LONG_TEXT_FIELDS.includes(f) && !NO_SPLIT_FIELDS.includes(f)) {
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

const HistoryPresentIllnessDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].history_present_illness && Array.isArray(templateData[0].history_present_illness)) records = templateData[0].history_present_illness;
    else if (templateData.length > 0 && templateData[0].history_of_present_illness && Array.isArray(templateData[0].history_of_present_illness)) records = templateData[0].history_of_present_illness;
    else records = templateData;
  } else if (templateData && templateData.history_present_illness) {
    records = Array.isArray(templateData.history_present_illness) ? templateData.history_present_illness : [templateData.history_present_illness];
  } else if (templateData && templateData.history_of_present_illness) {
    records = Array.isArray(templateData.history_of_present_illness) ? templateData.history_of_present_illness : [templateData.history_of_present_illness];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.history_present_illness ? (Array.isArray(dd.history_present_illness) ? dd.history_present_illness : [dd.history_present_illness]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>History of Present Illness</Text></View>
        <Text style={styles.emptyState}>No history of present illness records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>History of Present Illness</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`History of Present Illness ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasVal(getVal(record, f)));
              if (vis.length === 0) return null;
              return (
                <View key={sid} style={styles.section}>
                  {vis.flatMap((f, fi) => renderField(record, f, SECTION_TITLES[sid], fi === 0))}
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

export default HistoryPresentIllnessDocumentPDFTemplate;
