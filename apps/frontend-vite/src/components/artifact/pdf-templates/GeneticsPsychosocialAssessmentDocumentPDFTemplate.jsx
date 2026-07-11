/**
 * GeneticsPsychosocialAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX exactly: config-driven from
 * SECTION_ORDER / SECTION_TITLES / FIELD_LABELS / SECTION_FIELDS, real record.date (never createdAt),
 * DOTTED-PATH leaf fields (familyHistoryPedigree.*, socialSupportSystem.*, disclosureIntentions.*,
 * minorChildrenImpact.*, followUpCounselingPlan.*) resolved via getVal, values numbered ('1.' even
 * singles), single-name label gate, arrays with labeled items → sub-label + comma rows, narratives
 * split on [.;] with a CLAUSE_OPENER guard (grammatical "If X:" is not a Label:Value). Rule #74: each
 * field is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's
 * View. Static PHI footer. Collection: genetics_psychosocial_assessment.
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

const SECTION_ORDER = ['session-info', 'referral-genetics', 'psychosocial-response', 'reproductive-social', 'disclosure-children', 'capacity-guidance', 'follow-up-referrals'];
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'referral-genetics': 'Referral & Genetic Background',
  'psychosocial-response': 'Psychosocial Response',
  'reproductive-social': 'Reproductive & Social Factors',
  'disclosure-children': 'Disclosure & Minor Children',
  'capacity-guidance': 'Capacity & Guidance',
  'follow-up-referrals': 'Follow-Up & Referrals',
};
const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  referralIndication: 'Referral Indication',
  geneticConditionTested: 'Genetic Condition Tested',
  'familyHistoryPedigree.generations': 'Family History Pedigree — Generations',
  'familyHistoryPedigree.paternalLineage': 'Family History Pedigree — Paternal Lineage',
  'familyHistoryPedigree.maternalLineage': 'Family History Pedigree — Maternal Lineage',
  previousGeneticTesting: 'Previous Genetic Testing',
  emotionalResponseToRisk: 'Emotional Response to Risk',
  copingMechanisms: 'Coping Mechanisms',
  knowledgeOfInheritance: 'Knowledge of Inheritance',
  decisionalConflict: 'Decisional Conflict',
  riskPerception: 'Risk Perception',
  psychologicalDistress: 'Psychological Distress',
  reproductiveIntentions: 'Reproductive Intentions',
  'socialSupportSystem.individualTherapy': 'Social Support — Individual Therapy',
  'socialSupportSystem.familyTherapy': 'Social Support — Family Therapy',
  'socialSupportSystem.supportGroup': 'Social Support — Support Group',
  culturalBeliefs: 'Cultural Beliefs',
  insuranceConcerns: 'Insurance Concerns',
  'disclosureIntentions.familyLetter': 'Disclosure Intentions — Family Letter',
  'disclosureIntentions.extendedFamily': 'Disclosure Intentions — Extended Family',
  'minorChildrenImpact.children': 'Minor Children Impact — Children',
  'minorChildrenImpact.screening': 'Minor Children Impact — Screening',
  'minorChildrenImpact.geneticTesting': 'Minor Children Impact — Genetic Testing',
  informedConsentCapacity: 'Informed Consent Capacity',
  anticipatoryGuidance: 'Anticipatory Guidance',
  occupationalImplications: 'Occupational Implications',
  patientDecisionMaking: 'Patient Decision Making',
  'followUpCounselingPlan.resultsDisclosure': 'Follow-Up Counseling — Results Disclosure',
  'followUpCounselingPlan.cascadeTesting': 'Follow-Up Counseling — Cascade Testing',
  referralsMade: 'Referrals Made',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility'],
  'referral-genetics': ['referralIndication', 'geneticConditionTested', 'familyHistoryPedigree.generations', 'familyHistoryPedigree.paternalLineage', 'familyHistoryPedigree.maternalLineage', 'previousGeneticTesting'],
  'psychosocial-response': ['emotionalResponseToRisk', 'copingMechanisms', 'knowledgeOfInheritance', 'decisionalConflict', 'riskPerception', 'psychologicalDistress'],
  'reproductive-social': ['reproductiveIntentions', 'socialSupportSystem.individualTherapy', 'socialSupportSystem.familyTherapy', 'socialSupportSystem.supportGroup', 'culturalBeliefs', 'insuranceConcerns'],
  'disclosure-children': ['disclosureIntentions.familyLetter', 'disclosureIntentions.extendedFamily', 'minorChildrenImpact.children', 'minorChildrenImpact.screening', 'minorChildrenImpact.geneticTesting'],
  'capacity-guidance': ['informedConsentCapacity', 'anticipatoryGuidance', 'occupationalImplications', 'patientDecisionMaking'],
  'follow-up-referrals': ['followUpCounselingPlan.resultsDisclosure', 'followUpCounselingPlan.cascadeTesting', 'referralsMade'],
};
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['previousGeneticTesting', 'copingMechanisms', 'anticipatoryGuidance', 'referralsMade'];

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
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
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
  const sentences = splitBySentence(text);
  const rows = []; let n = 1;
  sentences.forEach(s => {
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

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = getVal(record, f);
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    const rows = []; let n = 1;
    items.forEach(it => {
      const parsed = parseLabel(safeString(it));
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        let m = 1; (parts.length >= 2 ? parts : [parsed.value]).forEach(p => rows.push({ type: 'item', text: safeString(p), num: m++ }));
      } else {
        rows.push({ type: 'item', text: safeString(it), num: n++ });
      }
    });
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {rows.map((r, i) => r.type === 'subtitle'
          ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
          : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)}
      </View>
    )];
  }

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {formatDate(val)}</Text>;
  } else {
    const rows = sentenceRows(safeString(fmtScalar(val)));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(fmtScalar(val))}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const GeneticsPsychosocialAssessmentDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].genetics_psychosocial_assessment && Array.isArray(templateData[0].genetics_psychosocial_assessment)) records = templateData[0].genetics_psychosocial_assessment;
    else records = templateData;
  } else if (templateData && templateData.genetics_psychosocial_assessment) {
    records = Array.isArray(templateData.genetics_psychosocial_assessment) ? templateData.genetics_psychosocial_assessment : [templateData.genetics_psychosocial_assessment];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.genetics_psychosocial_assessment ? (Array.isArray(dd.genetics_psychosocial_assessment) ? dd.genetics_psychosocial_assessment : [dd.genetics_psychosocial_assessment]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Genetics Psychosocial Assessment</Text></View>
        <Text style={styles.emptyState}>No genetics psychosocial assessment records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Genetics Psychosocial Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Genetics Psychosocial Assessment ${idx + 1}`}</Text>
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

export default GeneticsPsychosocialAssessmentDocumentPDFTemplate;
