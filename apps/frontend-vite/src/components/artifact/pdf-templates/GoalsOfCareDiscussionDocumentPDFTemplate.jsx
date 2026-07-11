/**
 * GoalsOfCareDiscussionDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: real record dates (never createdAt),
 * booleans Yes/No, string arrays (labeled items → subtitle), SENTENCE fields (primaryGoalsOfCare /
 * prognosisUnderstanding) split on [.;] with abbrev/single-initial/genus guard + labeled comma-split, plain
 * strings whole, values numbered ('1.' even singles), single-name label gate. Rule #74: each field is ONE
 * wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's View. Static PHI
 * footer. Collection: goals_of_care_discussion.
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

const SECTION_ORDER = ['session-info', 'decision-capacity', 'code-preferences', 'goals-prognosis', 'quality-values', 'follow-up'];
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'decision-capacity': 'Decision-Making & Advance Directives',
  'code-preferences': 'Code Status & Treatment Preferences',
  'goals-prognosis': 'Goals of Care & Prognosis',
  'quality-values': 'Quality of Life & Values',
  'follow-up': 'Follow-Up & Coordination',
};
const FIELD_LABELS = {
  date: 'Date', discussionDate: 'Discussion Date',
  participantsPresent: 'Participants Present', decisionMakingCapacity: 'Decision-Making Capacity',
  surrogateDecisionMaker: 'Surrogate Decision Maker', advanceDirectiveStatus: 'Advance Directive Status',
  codeStatus: 'Code Status', resuscitationPreferences: 'Resuscitation Preferences',
  intubationPreferences: 'Intubation Preferences', artificialNutritionHydration: 'Artificial Nutrition / Hydration',
  hospitalAdmissionPreferences: 'Hospital Admission Preferences', intensiveCarePreferences: 'Intensive Care Preferences',
  dialysisPreferences: 'Dialysis Preferences', antibioticPreferences: 'Antibiotic Preferences',
  primaryGoalsOfCare: 'Primary Goals of Care', prognosisDiscussed: 'Prognosis Discussed',
  prognosisUnderstanding: 'Prognosis Understanding', qualityOfLifeFactors: 'Quality of Life Factors',
  unacceptableOutcomes: 'Unacceptable Outcomes', spiritualCulturalFactors: 'Spiritual / Cultural Factors',
  palliativeCareConsult: 'Palliative Care Consult', hospiceDiscussion: 'Hospice Discussion',
  trialPeriodAgreed: 'Trial Period Agreed', followUpDiscussionPlan: 'Follow-Up Discussion Plan',
  familyConsensusDynamics: 'Family Consensus / Dynamics', physicianOrdersEntered: 'Physician Orders Entered',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'discussionDate'],
  'decision-capacity': ['participantsPresent', 'decisionMakingCapacity', 'surrogateDecisionMaker', 'advanceDirectiveStatus'],
  'code-preferences': ['codeStatus', 'resuscitationPreferences', 'intubationPreferences', 'artificialNutritionHydration', 'hospitalAdmissionPreferences', 'intensiveCarePreferences', 'dialysisPreferences', 'antibioticPreferences'],
  'goals-prognosis': ['primaryGoalsOfCare', 'prognosisDiscussed', 'prognosisUnderstanding'],
  'quality-values': ['qualityOfLifeFactors', 'unacceptableOutcomes', 'spiritualCulturalFactors'],
  'follow-up': ['palliativeCareConsult', 'hospiceDiscussion', 'trialPeriodAgreed', 'followUpDiscussionPlan', 'familyConsensusDynamics', 'physicianOrdersEntered'],
};
const DATE_FIELDS = ['date', 'discussionDate'];
const BOOLEAN_FIELDS = ['prognosisDiscussed', 'trialPeriodAgreed'];
const ARRAY_FIELDS = ['participantsPresent', 'qualityOfLifeFactors', 'unacceptableOutcomes', 'physicianOrdersEntered'];
const SENTENCE_FIELDS = ['primaryGoalsOfCare', 'prognosisUnderstanding'];

const getVal = (obj, path) => { if (!obj || !path) return undefined; return String(path).split('.').reduce((cur, part) => (cur === null || cur === undefined) ? undefined : cur[part], obj); };
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[×✕✖]/g, 'x').replace(/÷/g, '/')
    .replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{2,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
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

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = getVal(record, f);
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => {
          const ip = parseLabel(String(it));
          return ip.isLabeled
            ? <View key={i}><Text style={styles.subLabel}>{safeString(ip.label)}</Text><Text style={styles.value}>{i + 1}. {safeString(ip.value)}</Text></View>
            : <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>;
        })}
      </View>
    )];
  }

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {formatDate(val)}</Text>;
  } else if (BOOLEAN_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : safeString(fmtScalar(val))}</Text>;
  } else if (SENTENCE_FIELDS.includes(f)) {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  } else {
    body = <Text style={styles.value}>1. {safeString(fmtScalar(val))}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const GoalsOfCareDiscussionDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].goals_of_care_discussion && Array.isArray(templateData[0].goals_of_care_discussion)) records = templateData[0].goals_of_care_discussion;
    else records = templateData;
  } else if (templateData && templateData.goals_of_care_discussion) {
    records = Array.isArray(templateData.goals_of_care_discussion) ? templateData.goals_of_care_discussion : [templateData.goals_of_care_discussion];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.goals_of_care_discussion ? (Array.isArray(dd.goals_of_care_discussion) ? dd.goals_of_care_discussion : [dd.goals_of_care_discussion]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Goals of Care Discussion</Text></View>
        <Text style={styles.emptyState}>No goals of care discussion records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Goals of Care Discussion</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Goals of Care Discussion ${idx + 1}`}</Text>
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

export default GoalsOfCareDiscussionDocumentPDFTemplate;
