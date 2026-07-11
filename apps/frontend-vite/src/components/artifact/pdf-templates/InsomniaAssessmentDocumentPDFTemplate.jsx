import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * InsomniaAssessmentDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (numbers incl. 0 except hide-zero) for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * The record `date` is the FIRST field of the Assessment Information section (same record.date the JSX edits) —
 * NEVER keyed off createdAt/updatedAt.
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['assessment-info', 'sleep-metrics', 'insomnia-characterization', 'behavioral-environmental', 'comorbidities-medications', 'arousal-diagnostics', 'treatment-planning'];

const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'sleep-metrics': 'Sleep Metrics',
  'insomnia-characterization': 'Insomnia Characterization',
  'behavioral-environmental': 'Behavioral & Environmental Factors',
  'comorbidities-medications': 'Comorbidities & Medications',
  'arousal-diagnostics': 'Arousal & Diagnostics',
  'treatment-planning': 'Treatment Planning',
};

const FIELD_LABELS = {
  date: 'Date',
  sleepLatency: 'Sleep Latency (minutes)',
  totalSleepTime: 'Total Sleep Time (hours)',
  wakeAfterSleepOnset: 'Wake After Sleep Onset (minutes)',
  numberOfAwakenings: 'Number of Awakenings',
  sleepEfficiency: 'Sleep Efficiency (%)',
  insomniaType: 'Insomnia Type',
  insomniaSeverityIndex: 'Insomnia Severity Index (0-28)',
  symptomDuration: 'Symptom Duration',
  sleepScheduleRegularity: 'Sleep Schedule Regularity',
  bedtimeRoutine: 'Bedtime Routine',
  caffeineIntake: 'Caffeine Intake',
  alcoholUsePattern: 'Alcohol Use Pattern',
  daytimeNapping: 'Daytime Napping',
  sleepEnvironmentFactors: 'Sleep Environment Factors',
  comorbidSleepDisorders: 'Comorbid Sleep Disorders',
  psychiatricComorbidities: 'Psychiatric Comorbidities',
  medicationsCausingInsomnia: 'Medications Causing Insomnia',
  currentSleepMedications: 'Current Sleep Medications',
  epworthSleepinessScale: 'Epworth Sleepiness Scale (0-24)',
  cognitiveArousal: 'Cognitive Arousal',
  physiologicArousal: 'Physiologic Arousal',
  sleepDiaryCompleted: 'Sleep Diary Completed',
  actigraphyUsed: 'Actigraphy Used',
  polysomnographyIndicated: 'Polysomnography Indicated',
  cbtiEligibility: 'CBT-I Eligibility',
};

const SECTION_FIELDS = {
  'assessment-info': ['date'],
  'sleep-metrics': ['sleepLatency', 'totalSleepTime', 'wakeAfterSleepOnset', 'numberOfAwakenings', 'sleepEfficiency'],
  'insomnia-characterization': ['insomniaType', 'insomniaSeverityIndex', 'symptomDuration', 'sleepScheduleRegularity'],
  'behavioral-environmental': ['bedtimeRoutine', 'caffeineIntake', 'alcoholUsePattern', 'daytimeNapping', 'sleepEnvironmentFactors'],
  'comorbidities-medications': ['comorbidSleepDisorders', 'psychiatricComorbidities', 'medicationsCausingInsomnia', 'currentSleepMedications', 'epworthSleepinessScale'],
  'arousal-diagnostics': ['cognitiveArousal', 'physiologicArousal', 'sleepDiaryCompleted', 'actigraphyUsed', 'polysomnographyIndicated'],
  'treatment-planning': ['cbtiEligibility'],
};

const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['sleepLatency', 'totalSleepTime', 'wakeAfterSleepOnset', 'numberOfAwakenings', 'sleepEfficiency', 'insomniaSeverityIndex', 'epworthSleepinessScale'];
const BOOLEAN_FIELDS = ['sleepDiaryCompleted', 'actigraphyUsed', 'polysomnographyIndicated'];
const ARRAY_FIELDS = ['comorbidSleepDisorders', 'psychiatricComorbidities', 'medicationsCausingInsomnia', 'currentSleepMedications'];
/* SIMPLE_FIELDS render VERBATIM (no sentence/comma splitting) — sleepScheduleRegularity carries a
   semicolon INSIDE parentheses (weekday …; weekend …) that a non-paren-aware splitter would break. */
const SIMPLE_FIELDS = ['insomniaType', 'symptomDuration', 'sleepScheduleRegularity'];
/* HIDE_ZERO mirrors JSX: sleepLatency 0 / totalSleepTime 0 / sleepEfficiency 0 are not clinically
   reportable; insomniaSeverityIndex 0 / epworthSleepinessScale 0 mean "questionnaire not administered".
   wakeAfterSleepOnset 0 and numberOfAwakenings 0 stay visible (clinically meaningful). */
const HIDE_ZERO_FIELDS = ['sleepLatency', 'totalSleepTime', 'sleepEfficiency', 'insomniaSeverityIndex', 'epworthSleepinessScale'];

/* HELPERS (mirror the JSX) */
const safeString = (val) => {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, "");
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* arrItemText: same array-item stringification as JSX (4-AREA RULE) */
const arrItemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' - ');
  return String(item);
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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
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
   comma items into their own sub-label (mirrors the JSX decomposition; never side-by-side). A single
   unlabeled sentence that is a comma list is split into item rows (JSX aggressive-split parity). */
const sentenceRows = (text) => {
  const rows = [];
  const sentences = splitBySentence(text);
  if (sentences.length === 1 && !parseLabel(sentences[0]).isLabeled) {
    const items = splitByComma(sentences[0]);
    const hasOxford = items.some(ci => ci.trim().toLowerCase().startsWith('and '));
    if (items.length >= 2 && !hasOxford) { items.forEach(it => rows.push({ type: 'item', text: it })); return rows; }
    rows.push({ type: 'item', text: sentences[0] });
    return rows;
  }
  sentences.forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      const hasOxford = items.some(ci => ci.trim().toLowerCase().startsWith('and '));
      if (items.length >= 2 && !hasOxford) {
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
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : [v]).map(arrItemText).filter(Boolean);
    return items.map((it, i) => <Text key={i} style={styles.value}>{`${i + 1}. `}{safeString(it)}</Text>);
  }
  if (SIMPLE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const fieldHasVal = (record, f) => {
  const v = record[f];
  if (HIDE_ZERO_FIELDS.includes(f) && v === 0) return false;
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.some(item => arrItemText(item));
  return hasVal(v);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldHasVal(record, f));
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

const InsomniaAssessmentDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.flatMap(r => {
    if (r?.insomnia_assessment) return Array.isArray(r.insomnia_assessment) ? r.insomnia_assessment : [r.insomnia_assessment];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.insomnia_assessment) return Array.isArray(dd.insomnia_assessment) ? dd.insomnia_assessment : [dd.insomnia_assessment]; return [dd]; }
    return [r];
  }).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Insomnia Assessment</Text>
          <Text style={styles.noData}>No insomnia assessment records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Insomnia Assessment</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Insomnia Assessment ${(record._originalIdx ?? rIdx) + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default InsomniaAssessmentDocumentPDFTemplate;
