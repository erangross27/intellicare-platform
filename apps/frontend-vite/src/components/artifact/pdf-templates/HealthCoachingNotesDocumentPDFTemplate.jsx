/**
 * HealthCoachingNotesDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors HealthCoachingNotesDocument.jsx:
 * real record.date (never createdAt), 4 sections in SECTION_ORDER, hide-zero numerics
 * (numberShowsPDF: 0/null hidden unless doctor-edited), string-array numbered, narrative strings
 * ([.;] sentence-split with abbrev/single-initial + list-marker guard, labeled → subLabel + value,
 * thousands-guarded comma-split), values numbered ('1.' even singles), single-name label gate.
 * Rule #74: each field is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first
 * present field's View. Static PHI footer. Collection: health_coaching_notes.
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

/* ═══════ CONSTANTS ═══════ */
const SECTION_ORDER = ['session', 'goals-plan', 'assessment-metrics', 'behavioral-social'];
const SECTION_TITLES = {
  'session': 'Session',
  'goals-plan': 'Goals & Plan',
  'assessment-metrics': 'Assessment & Metrics',
  'behavioral-social': 'Behavioral & Social',
};
const FIELD_LABELS = {
  date: 'Date',
  coachingSessionNumber: 'Coaching Session Number',
  sessionDurationMinutes: 'Session Duration (Minutes)',
  coachingModality: 'Coaching Modality',
  programCompletionStatus: 'Program Completion Status',
  nextSessionScheduledDate: 'Next Session Scheduled Date',
  primaryHealthGoals: 'Primary Health Goals',
  behaviorChangeStage: 'Behavior Change Stage',
  nutritionGoalsSet: 'Nutrition Goals Set',
  physicalActivityGoals: 'Physical Activity Goals',
  actionPlanSteps: 'Action Plan Steps',
  goalAttainmentPercentage: 'Goal Attainment Percentage',
  healthRiskAssessmentScore: 'Health Risk Assessment Score',
  weeklyExerciseMinutes: 'Weekly Exercise Minutes',
  sleepQualityRating: 'Sleep Quality Rating',
  averageNightlySleepHours: 'Average Nightly Sleep Hours',
  stressLevel: 'Stress Level',
  selfEfficacyScore: 'Self-Efficacy Score',
  biometricProgressTracked: 'Biometric Progress Tracked',
  motivationalInterviewingTechniques: 'Motivational Interviewing Techniques',
  barriersIdentified: 'Barriers Identified',
  substanceUseScreening: 'Substance Use Screening',
  socialDeterminantsAddressed: 'Social Determinants Addressed',
  screeningsDue: 'Screenings Due',
  immunizationsDiscussed: 'Immunizations Discussed',
  referralsMade: 'Referrals Made',
};
const SECTION_FIELDS = {
  'session': ['date', 'coachingSessionNumber', 'sessionDurationMinutes', 'coachingModality', 'programCompletionStatus', 'nextSessionScheduledDate'],
  'goals-plan': ['primaryHealthGoals', 'behaviorChangeStage', 'nutritionGoalsSet', 'physicalActivityGoals', 'actionPlanSteps', 'goalAttainmentPercentage'],
  'assessment-metrics': ['healthRiskAssessmentScore', 'weeklyExerciseMinutes', 'sleepQualityRating', 'averageNightlySleepHours', 'stressLevel', 'selfEfficacyScore', 'biometricProgressTracked'],
  'behavioral-social': ['motivationalInterviewingTechniques', 'barriersIdentified', 'substanceUseScreening', 'socialDeterminantsAddressed', 'screeningsDue', 'immunizationsDiscussed', 'referralsMade'],
};
const DATE_FIELDS = ['date', 'nextSessionScheduledDate'];
const NUMBER_FIELDS = ['coachingSessionNumber', 'sessionDurationMinutes', 'healthRiskAssessmentScore', 'weeklyExerciseMinutes', 'sleepQualityRating', 'averageNightlySleepHours', 'selfEfficacyScore', 'stressLevel', 'goalAttainmentPercentage'];
const STRING_ARRAY_FIELDS = ['primaryHealthGoals', 'nutritionGoalsSet', 'physicalActivityGoals', 'motivationalInterviewingTechniques', 'barriersIdentified', 'actionPlanSteps', 'biometricProgressTracked', 'screeningsDue', 'immunizationsDiscussed', 'socialDeterminantsAddressed', 'referralsMade'];

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
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[×✕✖]/g, 'x').replace(/÷/g, '/')
    .replace(/²/g, '2').replace(/³/g, '3')
    .replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]|\d))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s)); };
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
  const strip = (x) => String(x).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();
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

/* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  return true;
};

const fieldPresent = (record, field) => {
  if (NUMBER_FIELDS.includes(field)) return numberShowsPDF(record, field);
  return hasVal(record[field]);
};

const renderField = (record, field, sectionTitle, isFirst) => {
  if (!fieldPresent(record, field)) return [];
  const val = record[field];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (STRING_ARRAY_FIELDS.includes(field)) {
    const items = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtVal(it))}</Text>)}
      </View>
    )];
  }

  let body;
  if (DATE_FIELDS.includes(field)) {
    body = <Text style={styles.value}>1. {formatDate(val)}</Text>;
  } else if (NUMBER_FIELDS.includes(field)) {
    body = <Text style={styles.value}>1. {String(val)}</Text>;
  } else {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const HealthCoachingNotesDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.health_coaching_notes) records = Array.isArray(data[0].health_coaching_notes) ? data[0].health_coaching_notes : [data[0].health_coaching_notes];
    else records = data;
  } else if (data?.health_coaching_notes) records = Array.isArray(data.health_coaching_notes) ? data.health_coaching_notes : [data.health_coaching_notes];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.health_coaching_notes) records = Array.isArray(dd.health_coaching_notes) ? dd.health_coaching_notes : [dd.health_coaching_notes]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Health Coaching Notes</Text></View>
        <Text style={styles.emptyState}>No health coaching notes records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Health Coaching Notes</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Health Coaching Notes ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const presentFields = (SECTION_FIELDS[sid] || []).filter(f => fieldPresent(record, f));
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
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default HealthCoachingNotesDocumentPDFTemplate;
