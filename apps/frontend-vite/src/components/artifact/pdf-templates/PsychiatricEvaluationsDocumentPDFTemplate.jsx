/**
 * PsychiatricEvaluationsDocumentPDFTemplate.jsx
 * Box-free canonical PDF — Helvetica — LETTER — psychiatric evaluations
 * Collection: psychiatric_evaluations
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

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s.replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
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

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatLabel = (key) => String(key).replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

/* ======= CONFIG (mirrors the JSX) ======= */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'chief-complaint': 'Chief Complaint',
  'hpi': 'History of Present Illness',
  'psychiatric-history': 'Psychiatric History',
  'substance-use': 'Substance Use History',
  'mental-status-exam': 'Mental Status Exam',
  'risk-assessment': 'Risk Assessment',
  'diagnosis': 'Diagnosis',
  'treatment-plan': 'Treatment Plan',
  'current-medications': 'Current Medications',
};
const SECTION_ORDER = ['record-info', 'chief-complaint', 'hpi', 'psychiatric-history', 'substance-use', 'mental-status-exam', 'risk-assessment', 'diagnosis', 'treatment-plan', 'current-medications'];

const STATIC_SECTION_FIELDS = {
  'record-info': ['date', 'psychiatrist'],
  'chief-complaint': ['chiefComplaint'],
  'hpi': ['historyOfPresentIllness'],
  'diagnosis': ['diagnosis'],
  'current-medications': ['medications'],
};

const OBJECT_SECTIONS = {
  'psychiatric-history': { root: 'psychiatricHistory', preferred: ['previousDiagnoses', 'diagnoses', 'previousEpisodes', 'hospitalizations', 'priorHospitalizations', 'previousMedications', 'previousTherapy', 'therapy', 'suicideAttempts', 'priorAttempts', 'selfHarm', 'substanceAbuse'] },
  'substance-use': { root: 'substanceUseHistory', preferred: ['alcohol', 'tobacco', 'cannabis', 'marijuana', 'drugs', 'illicitDrugs', 'otherSubstances', 'substanceUseDisorder', 'current'] },
  'mental-status-exam': { root: 'mentalStatusExam', preferred: ['appearance', 'behavior', 'speech', 'mood', 'affect', 'thoughtProcess', 'thoughtContent', 'perceptions', 'cognition', 'insight', 'judgment'] },
  'risk-assessment': { root: 'riskAssessment', preferred: ['suicidalIdeation', 'currentSI', 'intent', 'plan', 'homicidalIdeation', 'riskFactors', 'protectiveFactors', 'cssrs', 'cssrsScore', 'ingestionAssessment', 'priorAttempt', 'riskLevel'] },
  'treatment-plan': { root: 'treatmentPlan', preferred: ['immediateInterventions', 'medications', 'pharmacological', 'psychotherapy', 'psychosocialInterventions', 'supportGroups', 'lifestyle', 'recommendations', 'observation', 'labs', 'diagnostics', 'disposition', 'facility', 'followUp'] },
};

const FIELD_LABELS = {
  psychiatrist: 'Psychiatrist',
  date: 'Date',
  chiefComplaint: 'Chief Complaint',
  historyOfPresentIllness: 'History of Present Illness',
  diagnosis: 'Diagnosis',
  medications: 'Current Medications',
};

const SUBFIELD_LABELS = {
  previousDiagnoses: 'Previous Diagnoses', diagnoses: 'Diagnoses', previousEpisodes: 'Previous Episodes',
  hospitalizations: 'Hospitalizations', priorHospitalizations: 'Prior Hospitalizations',
  previousMedications: 'Previous Medications', previousTherapy: 'Previous Therapy', therapy: 'Therapy',
  suicideAttempts: 'Suicide Attempts', priorAttempts: 'Prior Attempts', selfHarm: 'Self-Harm', substanceAbuse: 'Substance Abuse',
  alcohol: 'Alcohol', tobacco: 'Tobacco', cannabis: 'Cannabis', marijuana: 'Marijuana', drugs: 'Drugs',
  illicitDrugs: 'Illicit Drugs', otherSubstances: 'Other Substances', substanceUseDisorder: 'Substance Use Disorder', current: 'Current',
  appearance: 'Appearance', behavior: 'Behavior', speech: 'Speech', mood: 'Mood', affect: 'Affect',
  thoughtProcess: 'Thought Process', thoughtContent: 'Thought Content', perceptions: 'Perceptions',
  cognition: 'Cognition', insight: 'Insight', judgment: 'Judgment',
  suicidalIdeation: 'Suicidal Ideation', currentSI: 'Current SI', intent: 'Intent', plan: 'Plan',
  homicidalIdeation: 'Homicidal Ideation', riskFactors: 'Risk Factors', protectiveFactors: 'Protective Factors',
  cssrs: 'C-SSRS', cssrsScore: 'C-SSRS Score', ingestionAssessment: 'Ingestion Assessment', priorAttempt: 'Prior Attempt', riskLevel: 'Risk Level',
  immediateInterventions: 'Immediate Interventions', medications: 'Medications', pharmacological: 'Pharmacological',
  psychotherapy: 'Psychotherapy', psychosocialInterventions: 'Psychosocial Interventions', supportGroups: 'Support Groups',
  lifestyle: 'Lifestyle', recommendations: 'Recommendations', observation: 'Observation', labs: 'Labs',
  diagnostics: 'Diagnostics', disposition: 'Disposition', facility: 'Facility', followUp: 'Follow-Up',
};

const DATE_FIELDS = ['date'];

/* ======= FIELD RESOLUTION (mirrors the JSX derive/resolve helpers) ======= */
const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let val = obj;
  for (const p of parts) { if (val === null || val === undefined) return undefined; val = val[p]; }
  return val;
};

const deriveObjectFields = (record, sid) => {
  const cfg = OBJECT_SECTIONS[sid];
  if (!cfg) return [];
  const obj = record?.[cfg.root];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const actualKeys = Object.keys(obj);
  const ordered = cfg.preferred.filter(k => actualKeys.includes(k));
  actualKeys.forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
  return ordered.map(k => `${cfg.root}.${k}`);
};

const resolveSectionFields = (record, sid) => {
  if (OBJECT_SECTIONS[sid]) return deriveObjectFields(record, sid);
  return STATIC_SECTION_FIELDS[sid] || [];
};

const getFieldLabel = (fn) => {
  if (FIELD_LABELS[fn]) return FIELD_LABELS[fn];
  const parts = fn.split('.');
  if (parts.length === 2) return SUBFIELD_LABELS[parts[1]] || formatLabel(parts[1]);
  return SUBFIELD_LABELS[fn] || formatLabel(fn);
};

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const labelEl = (label) => <Text key="l" style={styles.fieldLabel}>{safeString(label)}</Text>;

/* string field → optional bare label + sentence/comma value lines (mirrors JSX renderStringField display) */
const stringEls = (label, val, showLabel) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const els = [];
  if (showLabel) els.push(labelEl(label));
  if (sentences.length <= 1) {
    els.push(<Text key="v" style={styles.value}>{safeString(strVal)}</Text>);
    return els;
  }
  let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(<Text key={`sl${si}`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
      if (parts.length >= 2) parts.forEach((p, pi) => els.push(<Text key={`s${si}c${pi}`} style={styles.listItem}>{`${n++}. ${safeString(p)}`}</Text>));
      else els.push(<Text key={`s${si}v`} style={styles.listItem}>{`${n++}. ${safeString(parsed.value)}`}</Text>);
    } else {
      els.push(<Text key={`s${si}`} style={styles.listItem}>{`${n++}. ${safeString(s)}`}</Text>);
    }
  });
  return els;
};

/* string array → optional bare label + one numbered line per item */
const arrayEls = (label, val, showLabel) => {
  const items = Array.isArray(val) ? val.filter(Boolean) : [];
  if (items.length === 0) return [];
  const els = [];
  if (showLabel) els.push(labelEl(label));
  items.forEach((item, i) => els.push(<Text key={`i${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>));
  return els;
};

/* dispatch one field → flat element array */
const fieldEls = (record, f, sid) => {
  const val = getNestedValue(record, f);
  if (!hasVal(val)) return [];
  const label = getFieldLabel(f);
  const sectionTitle = SECTION_TITLES[sid] || '';
  const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
  if (DATE_FIELDS.includes(f)) return [labelEl(label), <Text key="v" style={styles.value}>{formatDate(val)}</Text>];
  if (Array.isArray(val)) return arrayEls(label, val, showLabel);
  if (typeof val === 'number') {
    const els = [];
    if (showLabel) els.push(labelEl(label));
    els.push(<Text key="v" style={styles.value}>{safeString(val)}</Text>);
    return els;
  }
  return stringEls(label, val, showLabel);
};

/* ======= COMPONENT ======= */
const PsychiatricEvaluationsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.psychiatric_evaluations) return Array.isArray(r.psychiatric_evaluations) ? r.psychiatric_evaluations : [r.psychiatric_evaluations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_evaluations) return Array.isArray(dd.psychiatric_evaluations) ? dd.psychiatric_evaluations : [dd.psychiatric_evaluations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychiatric Evaluations</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychiatric Evaluations</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Psychiatric Evaluation ${index + 1}`}</Text>
            </View>

            {SECTION_ORDER.map((sid) => {
              const fields = resolveSectionFields(record, sid);
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

export default PsychiatricEvaluationsDocumentPDFTemplate;
