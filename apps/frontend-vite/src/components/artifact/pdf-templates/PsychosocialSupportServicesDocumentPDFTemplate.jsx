/**
 * PsychosocialSupportServicesDocumentPDFTemplate.jsx
 * Box-free canonical PDF - Helvetica - LETTER - psychosocial support services
 * Collection: psychosocial_support_services
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 8, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

/* safeString: \u-escapes only (no literal smart-quotes / invisible chars) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s
    .replace(/\u00d7/g, 'x')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um')
    .replace(/\u00b0/g, ' deg').replace(/\u00b1/g, '+/-')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=').replace(/\u2192/g, '->');
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const safeArray = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware with Oxford ("and"/"or") + numeric-thousands ("$12,500") guards */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest) || /^\d/.test(text[i + 1] || '')) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= CONFIG (mirrors JSX) ======= */
const SECTION_TITLES = {
  'screening-scores': 'Screening Scores',
  'clinical-assessment': 'Clinical Assessment',
  'treatment-support': 'Treatment & Support',
  'functional-cognitive': 'Functional & Cognitive',
  'social-factors': 'Social Factors',
};
const SECTION_ORDER = ['screening-scores', 'clinical-assessment', 'treatment-support', 'functional-cognitive', 'social-factors'];
const SECTION_FIELDS = {
  'screening-scores': ['phq9Score', 'gad7Score', 'columbiaScore', 'auditScore', 'aceScore'],
  'clinical-assessment': ['primaryDiagnosis', 'suicidalIdeation', 'substanceUseDisorder', 'traumaHistory', 'crisisInterventionProvided'],
  'treatment-support': ['therapyModalityProvided', 'copingMechanisms', 'referralsMade', 'treatmentAdherence', 'supportSystemStrength'],
  'functional-cognitive': ['functionalAssessment', 'cognitiveFunction'],
  'social-factors': ['socialDeterminantsScreening', 'housingStability', 'culturalConsiderations', 'dischargeDisposition'],
};
const FIELD_LABELS = {
  phq9Score: 'PHQ-9 Score',
  gad7Score: 'GAD-7 Score',
  columbiaScore: 'Columbia Score',
  auditScore: 'AUDIT Score',
  aceScore: 'ACE Score',
  primaryDiagnosis: 'Primary Diagnosis',
  suicidalIdeation: 'Suicidal Ideation',
  substanceUseDisorder: 'Substance Use Disorder',
  traumaHistory: 'Trauma History',
  crisisInterventionProvided: 'Crisis Intervention Provided',
  therapyModalityProvided: 'Therapy Modality Provided',
  copingMechanisms: 'Coping Mechanisms',
  referralsMade: 'Referrals Made',
  treatmentAdherence: 'Treatment Adherence',
  supportSystemStrength: 'Support System Strength',
  functionalAssessment: 'Functional Assessment',
  cognitiveFunction: 'Cognitive Function',
  socialDeterminantsScreening: 'Social Determinants Screening',
  housingStability: 'Housing Stability',
  culturalConsiderations: 'Cultural Considerations',
  dischargeDisposition: 'Discharge Disposition',
};
const BOOLEAN_FIELDS = ['suicidalIdeation', 'substanceUseDisorder', 'traumaHistory', 'crisisInterventionProvided'];
const NUMBER_FIELDS = ['phq9Score', 'gad7Score', 'columbiaScore', 'auditScore', 'aceScore'];
const ARRAY_FIELDS = ['therapyModalityProvided', 'copingMechanisms', 'referralsMade'];

/* isHiddenZero: a NUMBER field valued 0 is an extractor "not-assessed" sentinel (hidden), unless meaningful. */
const MEANINGFUL_ZERO_FIELDS = [];
const isHiddenZero = (fn, v) => NUMBER_FIELDS.includes(fn) && !MEANINGFUL_ZERO_FIELDS.includes(fn) && Number(v) === 0;

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const labelEl = (f) => <Text key={`${f}-l`} style={styles.fieldLabel}>{FIELD_LABELS[f] || f}</Text>;

/* sentence field -> bare label + sentence/comma value lines (mirrors JSX renderStringField display) */
const sentenceEls = (f, val, showLabel) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const parsedWhole = parseLabel(strVal);
  const singleLabeledList = sentences.length === 1 && parsedWhole.isLabeled && splitByComma(parsedWhole.value).length >= 2;
  const els = [];
  if (showLabel) els.push(labelEl(f));
  if (sentences.length <= 1 && !singleLabeledList) {
    els.push(<Text key={`${f}-v`} style={styles.value}>{safeString(strVal)}</Text>);
    return els;
  }
  let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(<Text key={`${f}-sl${si}`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
      if (parts.length >= 2) parts.forEach((p, pi) => els.push(<Text key={`${f}-s${si}c${pi}`} style={styles.listItem}>{`${n++}. ${safeString(p)}`}</Text>));
      else els.push(<Text key={`${f}-s${si}v`} style={styles.listItem}>{`${n++}. ${safeString(parsed.value)}`}</Text>);
    } else {
      els.push(<Text key={`${f}-s${si}`} style={styles.listItem}>{`${n++}. ${safeString(s)}`}</Text>);
    }
  });
  return els;
};

/* boolean field -> bare label + Yes/No value */
const booleanEls = (f, val, showLabel) => {
  const els = [];
  if (showLabel) els.push(labelEl(f));
  els.push(<Text key={`${f}-v`} style={styles.value}>{val ? 'Yes' : 'No'}</Text>);
  return els;
};

/* number field -> bare label + numeric value */
const numberEls = (f, val, showLabel) => {
  const els = [];
  if (showLabel) els.push(labelEl(f));
  els.push(<Text key={`${f}-v`} style={styles.value}>{safeString(fmtVal(val))}</Text>);
  return els;
};

/* plain string array (therapyModalityProvided, copingMechanisms, referralsMade) -> label + numbered lines */
const arrayEls = (f, val, showLabel) => {
  const items = safeArray(val);
  if (items.length === 0) return [];
  const els = [];
  if (showLabel) els.push(labelEl(f));
  items.forEach((item, i) => els.push(<Text key={`${f}-a${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>));
  return els;
};

/* dispatch one field -> flat element array */
const fieldEls = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val) || isHiddenZero(f, val)) return [];
  const sectionTitle = SECTION_TITLES[sid] || '';
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
  if (ARRAY_FIELDS.includes(f)) return arrayEls(f, val, showLabel);
  if (BOOLEAN_FIELDS.includes(f)) return booleanEls(f, val, showLabel);
  if (NUMBER_FIELDS.includes(f)) return numberEls(f, val, showLabel);
  return sentenceEls(f, val, showLabel);
};

/* ======= COMPONENT ======= */
const PsychosocialSupportServicesDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.psychosocial_support_services) return Array.isArray(r.psychosocial_support_services) ? r.psychosocial_support_services : [r.psychosocial_support_services];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychosocial_support_services) return Array.isArray(dd.psychosocial_support_services) ? dd.psychosocial_support_services : [dd.psychosocial_support_services]; if (dd?.records) return Array.isArray(dd.records) ? dd.records : [dd.records]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychosocial Support Services</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychosocial Support Services</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Psychosocial Support Services ${index + 1}`}</Text>
            </View>

            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid] || [];
              const flat = [];
              fields.forEach(f => flat.push(...fieldEls(record, f, sid)));
              if (flat.length === 0) return null;
              const first = React.cloneElement(flat[0], { key: 'f0' });
              const rest = flat.slice(1).map((el, i) => React.cloneElement(el, { key: `f${i + 1}` }));
              return (
                <View key={sid} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                    {first}
                  </View>
                  {rest}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PsychosocialSupportServicesDocumentPDFTemplate;
