/**
 * ConcussionAssessmentDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first present field's View (anti-orphan, 6a2d6af6).
 * Sections/fields mirror the JSX + copy exactly (4-area mirror). Score fields emit
 * "1. <value><unit> (<interpretation>)"; numeric 0 = batch-extraction default (GCS 0 is impossible) →
 * hidden unless doctor-edited; priorConcussionCount keeps 0 (a real "none" count).
 * Collection: concussion_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginBottom: 3, marginTop: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_DEFS = [
  ['Injury Information', ['date', 'injuryDateTime', 'mechanismOfInjury', 'sportActivity', 'lossOfConsciousness', 'lossOfConsciousnessDuration', 'postTraumaticAmnesia']],
  ['Assessment Scores', ['glasgowComaScore', 'scat5TotalScore', 'symptomSeverityScore', 'numberOfSymptoms']],
  ['Symptoms', ['headachePresent', 'nauseaVomiting', 'dizzinessBalance', 'visualDisturbances', 'photoPhonophobia', 'cognitiveImpairment', 'neckPainTenderness']],
  ['Cognitive & Balance Testing', ['immediateMemoryScore', 'delayedRecallScore', 'concentrationScore', 'balanceErrorScoringSystem', 'tandemGaitTime']],
  ['Imaging & History', ['imagingPerformed', 'priorConcussionCount', 'redFlagsPresent']],
  ['Return to Play', ['returnToPlayCleared', 'returnToPlayStage']],
];
const FIELD_LABELS = {
  date: 'Date', injuryDateTime: 'Injury Date/Time', mechanismOfInjury: 'Mechanism of Injury',
  sportActivity: 'Sport/Activity', lossOfConsciousness: 'Loss of Consciousness',
  lossOfConsciousnessDuration: 'Loss of Consciousness Duration (seconds)', postTraumaticAmnesia: 'Post-Traumatic Amnesia',
  glasgowComaScore: 'Glasgow Coma Score', scat5TotalScore: 'SCAT5 Total Score',
  symptomSeverityScore: 'Symptom Severity Score', numberOfSymptoms: 'Number of Symptoms',
  headachePresent: 'Headache', nauseaVomiting: 'Nausea/Vomiting',
  dizzinessBalance: 'Dizziness/Balance Problems', visualDisturbances: 'Visual Disturbances',
  photoPhonophobia: 'Photophobia/Phonophobia', cognitiveImpairment: 'Cognitive Impairment',
  neckPainTenderness: 'Neck Pain/Tenderness',
  immediateMemoryScore: 'Immediate Memory Score', delayedRecallScore: 'Delayed Recall Score',
  concentrationScore: 'Concentration Score', balanceErrorScoringSystem: 'Balance Error Scoring System',
  tandemGaitTime: 'Tandem Gait Time',
  imagingPerformed: 'Imaging Performed', priorConcussionCount: 'Prior Concussion Count',
  redFlagsPresent: 'Red Flags Present',
  returnToPlayCleared: 'Return to Play Cleared', returnToPlayStage: 'Return to Play Stage',
};
const SENTENCE_FIELDS = ['mechanismOfInjury', 'imagingPerformed'];
const ARRAY_FIELDS = ['redFlagsPresent'];
const DATE_FIELDS = ['date'];
const DATETIME_FIELDS = ['injuryDateTime'];
const NUMERIC_FIELDS = ['lossOfConsciousnessDuration', 'glasgowComaScore', 'scat5TotalScore', 'symptomSeverityScore', 'numberOfSymptoms', 'immediateMemoryScore', 'delayedRecallScore', 'concentrationScore', 'balanceErrorScoringSystem', 'tandemGaitTime', 'priorConcussionCount'];
const MEANINGFUL_ZERO_FIELDS = ['priorConcussionCount'];

// Score interpretation (mirrors the JSX bar chart's ranges — same text in copy + PDF).
const SCORE_RANGES = {
  gcs: { normalMin: 15, concernMin: 13, higherIsBetter: true },
  scat5: { normalMax: 10, concernMax: 30, higherIsBetter: false },
  symptomSeverity: { normalMax: 10, concernMax: 40, higherIsBetter: false },
  numberOfSymptoms: { normalMax: 3, concernMax: 10, higherIsBetter: false },
  immediateMemory: { normalMin: 13, concernMin: 10, higherIsBetter: true },
  delayedRecall: { normalMin: 4, concernMin: 2, higherIsBetter: true },
  concentration: { normalMin: 4, concernMin: 2, higherIsBetter: true },
  bess: { normalMax: 5, concernMax: 15, higherIsBetter: false },
  tandemGait: { normalMax: 14, concernMax: 18, higherIsBetter: false },
};
const SCORE_INTERPRETATIONS = {
  gcs: { normal: 'Normal', concern: 'Mild TBI', abnormal: 'Moderate-Severe TBI' },
  scat5: { normal: 'Normal', concern: 'Mild Symptoms', abnormal: 'Significant Symptoms' },
  symptomSeverity: { normal: 'Normal', concern: 'Mild Severity', abnormal: 'Significant Severity' },
  numberOfSymptoms: { normal: 'Normal', concern: 'Mild', abnormal: 'Significant' },
  immediateMemory: { normal: 'Normal', concern: 'Mild Impairment', abnormal: 'Significant Impairment' },
  delayedRecall: { normal: 'Normal', concern: 'Mild Impairment', abnormal: 'Significant Impairment' },
  concentration: { normal: 'Normal', concern: 'Mild Impairment', abnormal: 'Significant Impairment' },
  bess: { normal: 'Normal', concern: 'Mild Imbalance', abnormal: 'Significant Imbalance' },
  tandemGait: { normal: 'Normal', concern: 'Mild Impairment', abnormal: 'Significant Impairment' },
};
const SCORE_MAP = {
  glasgowComaScore: { testType: 'gcs', unit: '/15' },
  scat5TotalScore: { testType: 'scat5', unit: '/100' },
  symptomSeverityScore: { testType: 'symptomSeverity', unit: '/132' },
  numberOfSymptoms: { testType: 'numberOfSymptoms', unit: '/22' },
  immediateMemoryScore: { testType: 'immediateMemory', unit: '/15' },
  delayedRecallScore: { testType: 'delayedRecall', unit: '/5' },
  concentrationScore: { testType: 'concentration', unit: '/5' },
  balanceErrorScoringSystem: { testType: 'bess', unit: '/30 errors' },
  tandemGaitTime: { testType: 'tandemGait', unit: ' sec' },
};
const getScoreInterpretation = (value, testType) => { if (value === null || value === undefined) return ''; const range = SCORE_RANGES[testType]; const interp = SCORE_INTERPRETATIONS[testType]; if (!range || !interp) return ''; if (range.higherIsBetter) { if (value >= range.normalMin) return interp.normal; if (value >= range.concernMin) return interp.concern; return interp.abnormal; } else { if (value <= range.normalMax) return interp.normal; if (value <= range.concernMax) return interp.concern; return interp.abnormal; } };

const safeString = (v) => { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'Yes' : 'No'; return String(v); };
const safeArray = (v) => Array.isArray(v) ? v : [];
const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const formatDateTime = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
// Numeric 0 is a batch-extraction default (GCS 0 is impossible) — hide unless doctor-edited; priorConcussionCount keeps 0.
const numberShowsPDF = (record, fn) => {
  const v = record?.[fn];
  if (v === null || v === undefined || v === '') return false;
  const num = Number(v);
  if (Number.isNaN(num)) return false;
  if (num === 0) {
    if (MEANINGFUL_ZERO_FIELDS.includes(fn)) return true;
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
  }
  return true;
};
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
// Paren-aware; keeps Oxford ", and/or X" attached; skips no-space commas ("$18,000") and date commas.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

// Build a field's display lines ({k:'label'|'sub'|'row', t}) or null when empty. Mirrors the JSX + copy.
const buildFieldLines = (record, f, title) => {
  const val = record[f];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== title.toLowerCase();
  const lines = [];
  if (ARRAY_FIELDS.includes(f)) {
    const arr = safeArray(val).filter(hasVal);
    if (arr.length === 0) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    arr.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${safeString(item)}` }));
  } else if (SCORE_MAP[f]) {
    if (!numberShowsPDF(record, f)) return null;
    const sm = SCORE_MAP[f]; const interp = getScoreInterpretation(val, sm.testType);
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${val}${sm.unit}${interp ? ` (${interp})` : ''}` });
  } else if (NUMERIC_FIELDS.includes(f)) {
    if (!numberShowsPDF(record, f)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${safeString(val)}` });
  } else if (DATE_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${formatDate(val)}` });
  } else if (DATETIME_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${formatDateTime(val)}` });
  } else if (SENTENCE_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    let n = 0;
    splitBySentence(safeString(val)).forEach(s => {
      const p = parseLabel(s);
      const content = p ? p.content : s.replace(/[;.]+$/, '').trim();
      const c = splitByComma(content);
      if (c.length >= 3) { if (p) { lines.push({ k: 'sub', t: p.label }); n = 0; } c.forEach(part => lines.push({ k: 'row', t: `${++n}. ${part.replace(/[;.]+$/, '').trim()}` })); }
      else lines.push({ k: 'row', t: `${++n}. ${s.replace(/[;.]+$/, '').trim()}` });
    });
  } else {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${safeString(val)}` });
  }
  return lines.length ? lines : null;
};

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View.
   Threshold 20 keeps short fields whole (no title/sub-label orphans); long lists flow. */
const renderFieldView = (lines, title, isFirst, keyId) => (
  <View key={keyId} style={styles.fieldUnit} wrap={lines.length > 20 ? true : false}>
    {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    {lines.map((ln, i) => {
      if (ln.k === 'label') return <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>;
      if (ln.k === 'sub') return <Text key={i} style={styles.subLabel}>{ln.t}</Text>;
      return <Text key={i} style={styles.listItem}>{ln.t}</Text>;
    })}
  </View>
);

const renderSection = (record, title, fields) => {
  const units = fields.map(f => buildFieldLines(record, f, title)).filter(Boolean);
  if (units.length === 0) return null;
  return <View key={title} style={styles.section}>{units.map((lines, i) => renderFieldView(lines, title, i === 0, `${title}-${i}`))}</View>;
};

const ConcussionAssessmentDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.concussion_assessment) return Array.isArray(r.concussion_assessment) ? r.concussion_assessment : [r.concussion_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.concussion_assessment) return Array.isArray(dd.concussion_assessment) ? dd.concussion_assessment : [dd.concussion_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Concussion Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Concussion Assessment</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Concussion Assessment ${idx + 1}`}</Text>
            </View>
            {SECTION_DEFS.map(([title, fields]) => renderSection(record, title, fields))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ConcussionAssessmentDocumentPDFTemplate;
