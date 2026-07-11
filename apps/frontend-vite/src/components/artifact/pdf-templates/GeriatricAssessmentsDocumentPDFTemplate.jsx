/**
 * GeriatricAssessmentsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX exactly: config-driven from
 * SECTION_ORDER / SECTION_TITLES / FIELD_LABELS / SECTION_FIELDS. NUMBER-heavy geriatric scores panel
 * with SENTINEL-ZERO (memory 6a5087fa): every scale's 0 = batch-default "not assessed" → hidden on ALL
 * number fields. fallsRiskAssessment → enum canonical; delirium4aTestResult → Yes/No boolean;
 * comprehensiveGeriatricAssessmentDomains → numbered array; narratives split on [.;]. Values numbered
 * ('1.' even singles), single-name label gate. Rule #74: each field is ONE wrap={false} atomic View
 * with the sectionTitle riding INSIDE the first present field's View. Static PHI footer. No date field.
 * Collection: geriatric_assessments.
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

const SECTION_ORDER = ['cognitive', 'functional', 'falls-balance', 'nutrition', 'comorbidity', 'physical'];
const SECTION_TITLES = {
  'cognitive': 'Cognitive Assessment',
  'functional': 'Functional Assessment',
  'falls-balance': 'Falls & Balance',
  'nutrition': 'Nutrition',
  'comorbidity': 'Comorbidity & Medications',
  'physical': 'Physical & Sensory Assessment',
};
const FIELD_LABELS = {
  cognitiveFunctionScore: 'Cognitive Function Score',
  montrealCognitiveAssessment: 'Montreal Cognitive Assessment (MoCA)',
  cognitiveImpairmentType: 'Cognitive Impairment Type',
  delirium4aTestResult: '4AT Delirium Test Result',
  activitiesOfDailyLivingScore: 'Activities of Daily Living (ADL) Score',
  instrumentalAdlScore: 'Instrumental ADL Score',
  geriatricDepressionScale: 'Geriatric Depression Scale (GDS)',
  timedUpAndGoTest: 'Timed Up and Go Test (seconds)',
  bergBalanceScore: 'Berg Balance Score',
  fallsRiskAssessment: 'Falls Risk Assessment',
  morseFaillScaleScore: 'Morse Fall Scale Score',
  nutritionalRiskScreening: 'Nutritional Risk Screening',
  miniNutritionalAssessment: 'Mini Nutritional Assessment',
  bradenScaleScore: 'Braden Scale Score',
  polypharmacyMedCount: 'Polypharmacy Medication Count',
  beerscriteriaViolations: 'Beers Criteria Violations',
  charlsonComorbidityIndex: 'Charlson Comorbidity Index',
  frailtyScore: 'Frailty Score',
  handGripStrength: 'Hand Grip Strength (kg)',
  walkingSpeed: 'Walking Speed (m/s)',
  socialSupportAssessment: 'Social Support Assessment',
  hearingImpairmentLevel: 'Hearing Impairment Level',
  visualAcuityAssessment: 'Visual Acuity Assessment',
  comprehensiveGeriatricAssessmentDomains: 'Comprehensive Geriatric Assessment Domains',
};
const SECTION_FIELDS = {
  'cognitive': ['cognitiveFunctionScore', 'montrealCognitiveAssessment', 'cognitiveImpairmentType', 'delirium4aTestResult'],
  'functional': ['activitiesOfDailyLivingScore', 'instrumentalAdlScore', 'geriatricDepressionScale'],
  'falls-balance': ['timedUpAndGoTest', 'bergBalanceScore', 'fallsRiskAssessment', 'morseFaillScaleScore'],
  'nutrition': ['nutritionalRiskScreening', 'miniNutritionalAssessment', 'bradenScaleScore'],
  'comorbidity': ['polypharmacyMedCount', 'beerscriteriaViolations', 'charlsonComorbidityIndex', 'frailtyScore'],
  'physical': ['handGripStrength', 'walkingSpeed', 'socialSupportAssessment', 'hearingImpairmentLevel', 'visualAcuityAssessment', 'comprehensiveGeriatricAssessmentDomains'],
};
const NUMBER_FIELDS = [
  'cognitiveFunctionScore', 'montrealCognitiveAssessment',
  'activitiesOfDailyLivingScore', 'instrumentalAdlScore', 'geriatricDepressionScale',
  'timedUpAndGoTest', 'bergBalanceScore', 'morseFaillScaleScore',
  'bradenScaleScore', 'nutritionalRiskScreening', 'miniNutritionalAssessment',
  'polypharmacyMedCount', 'beerscriteriaViolations', 'charlsonComorbidityIndex', 'frailtyScore',
  'handGripStrength', 'walkingSpeed',
];
const HIDE_ZERO_FIELDS = [...NUMBER_FIELDS];
const BOOLEAN_FIELDS = ['delirium4aTestResult'];
const ENUM_FIELDS = ['fallsRiskAssessment'];
const ENUM_OPTIONS = { fallsRiskAssessment: ['Low', 'Moderate', 'High'] };
const ARRAY_FIELDS = ['comprehensiveGeriatricAssessmentDomains'];
const enumCanonical = (options, val) => { const cur = String(val ?? '').trim(); const hit = (options || []).find(o => o.toLowerCase() === cur.toLowerCase()); return hit || cur; };

const getVal = (obj, path) => { if (!obj || !path) return undefined; return String(path).split('.').reduce((cur, part) => (cur === null || cur === undefined) ? undefined : cur[part], obj); };

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
// Sentinel-zero: hide a 0 on any HIDE_ZERO_FIELDS scale (0 = batch-default "not assessed").
const hasFieldVal = (f, v) => { if (HIDE_ZERO_FIELDS.includes(f) && v === 0) return false; return hasVal(v); };
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
  if (!hasFieldVal(f, val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>)}
      </View>
    )];
  }

  let body;
  if (BOOLEAN_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {val ? 'Yes' : 'No'}</Text>;
  } else if (ENUM_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(enumCanonical(ENUM_OPTIONS[f] || [], fmtScalar(val)))}</Text>;
  } else if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(fmtScalar(val))}</Text>;
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

const GeriatricAssessmentsDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].geriatric_assessments && Array.isArray(templateData[0].geriatric_assessments)) records = templateData[0].geriatric_assessments;
    else records = templateData;
  } else if (templateData && templateData.geriatric_assessments) {
    records = Array.isArray(templateData.geriatric_assessments) ? templateData.geriatric_assessments : [templateData.geriatric_assessments];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.geriatric_assessments ? (Array.isArray(dd.geriatric_assessments) ? dd.geriatric_assessments : [dd.geriatric_assessments]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Geriatric Assessments</Text></View>
        <Text style={styles.emptyState}>No geriatric assessments records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Geriatric Assessments</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Geriatric Assessment ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasFieldVal(f, getVal(record, f)));
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

export default GeriatricAssessmentsDocumentPDFTemplate;
