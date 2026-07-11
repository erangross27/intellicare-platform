/**
 * HematologyAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors HematologyAssessmentDocument.jsx:
 * real record.date (never createdAt), 15 sections in SECTION_ORDER, dotted-path fields (resolvePath),
 * deep recursive objects (boneMarrow/coagulation/results/prognosis) and object-arrays
 * (chemotherapy/clinicalTrials/recommendations/growthFactors) flattened box-free — scalars inline
 * "Key: value", arrays numbered, nested objects under a subLabel. Narrative strings use [.;]
 * sentence-split (abbrev/single-initial guard, NO \d guard, labeled → subLabel + value,
 * thousands-guarded comma-split). Values numbered ('1.' even singles). Single-name label gate
 * (supportiveCare / followUp / boneMarrow === their section title → field label hidden).
 * Rule #74: each field is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first
 * present field's View. Static PHI footer. Collection: hematology_assessment.
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
const SECTION_ORDER = ['session-info', 'diagnosis', 'blood-smear', 'hemoglobinopathy', 'coagulation', 'bone-marrow', 'transfusion', 'treatment-plan', 'chemotherapy', 'supportive-care', 'transplant-trials', 'prognosis', 'results', 'follow-up', 'clinical-notes'];
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'diagnosis': 'Diagnosis',
  'blood-smear': 'Blood Smear',
  'hemoglobinopathy': 'Hemoglobinopathy - Electrophoresis',
  'coagulation': 'Coagulation',
  'bone-marrow': 'Bone Marrow',
  'transfusion': 'Transfusion',
  'treatment-plan': 'Treatment Plan - Immediate Interventions',
  'chemotherapy': 'Chemotherapy/Disease-Modifying Therapy',
  'supportive-care': 'Supportive Care',
  'transplant-trials': 'Transplant & Clinical Trials',
  'prognosis': 'Prognosis',
  'results': 'Results',
  'follow-up': 'Follow Up',
  'clinical-notes': 'Clinical Notes',
};
const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  bloodDisorder: 'Blood Disorder',
  stagingClassification: 'Staging/Classification',
  'bloodSmear.rbcMorphology': 'RBC Morphology',
  'bloodSmear.inclusions': 'Inclusions',
  'bloodSmear.polychromasia': 'Polychromasia',
  'bloodSmear.interpretation': 'Interpretation',
  'hemoglobinopathy.electrophoresis.HbS': 'HbS (Sickle)',
  'hemoglobinopathy.electrophoresis.HbF': 'HbF (Fetal)',
  'hemoglobinopathy.electrophoresis.HbA2': 'HbA2',
  'hemoglobinopathy.electrophoresis.HbA': 'HbA (Normal)',
  'hemoglobinopathy.sickling': 'Sickling',
  'transfusion.bloodType': 'Blood Type',
  'transfusion.antibodyScreen': 'Antibody Screen',
  'transfusion.reactions': 'Reactions',
  'treatmentPlan.immediateInterventions.painControl': 'Pain Control',
  'treatmentPlan.immediateInterventions.hydration': 'Hydration',
  'treatmentPlan.immediateInterventions.oxygenation': 'Oxygenation',
  'treatmentPlan.immediateInterventions.monitoring': 'Monitoring',
  chemotherapy: 'Chemotherapy',
  supportiveCare: 'Supportive Care',
  transfusionSupport: 'Transfusion Support',
  growthFactors: 'Growth Factors',
  transplantEligibility: 'Transplant Eligibility',
  clinicalTrials: 'Clinical Trials',
  'prognosis.shortTerm': 'Short Term',
  'prognosis.longTerm': 'Long Term',
  'prognosis.riskFactors': 'Risk Factors',
  'prognosis.protectiveFactors': 'Protective Factors',
  followUp: 'Follow Up',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  coagulation: 'Coagulation',
  boneMarrow: 'Bone Marrow',
  results: 'Results',
  notes: 'Notes',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility'],
  'diagnosis': ['bloodDisorder', 'stagingClassification'],
  'blood-smear': ['bloodSmear.rbcMorphology', 'bloodSmear.inclusions', 'bloodSmear.polychromasia', 'bloodSmear.interpretation'],
  'hemoglobinopathy': ['hemoglobinopathy.electrophoresis.HbS', 'hemoglobinopathy.electrophoresis.HbF', 'hemoglobinopathy.electrophoresis.HbA2', 'hemoglobinopathy.electrophoresis.HbA', 'hemoglobinopathy.sickling'],
  'coagulation': ['coagulation'],
  'bone-marrow': ['boneMarrow'],
  'transfusion': ['transfusion.bloodType', 'transfusion.antibodyScreen', 'transfusion.reactions'],
  'treatment-plan': ['treatmentPlan.immediateInterventions.painControl', 'treatmentPlan.immediateInterventions.hydration', 'treatmentPlan.immediateInterventions.oxygenation', 'treatmentPlan.immediateInterventions.monitoring'],
  'chemotherapy': ['chemotherapy'],
  'supportive-care': ['supportiveCare', 'transfusionSupport', 'growthFactors'],
  'transplant-trials': ['transplantEligibility', 'clinicalTrials'],
  'prognosis': ['prognosis.shortTerm', 'prognosis.longTerm', 'prognosis.riskFactors', 'prognosis.protectiveFactors'],
  'results': ['results'],
  'follow-up': ['followUp'],
  'clinical-notes': ['findings', 'assessment', 'plan', 'recommendations', 'notes'],
};
const DATE_FIELDS = ['date'];

const resolvePath = (obj, path) => { if (!obj || !path) return undefined; return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj); };
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
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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

/* Recursively flatten a nested object into box-free rows (scalars inline "Key: value") */
const objectRows = (obj, kp) => {
  const out = [];
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const key = `${kp}.${k}.${i}`;
    if (isScalar(v)) {
      out.push(<Text key={key} style={styles.value}>{humanizeKey(k)}: {safeString(fmtScalar(v))}</Text>);
    } else if (Array.isArray(v)) {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{humanizeKey(k)}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach((it, j) => {
        if (isScalar(it)) out.push(<Text key={key + '-' + j} style={styles.value}>{j + 1}. {safeString(fmtScalar(it))}</Text>);
        else objectRows(it, key + '-' + j).forEach(r => out.push(r));
      });
    } else {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{humanizeKey(k)}</Text>);
      objectRows(v, key).forEach(r => out.push(r));
    }
  });
  return out;
};

/* Top-level value → rows for one field */
const fieldBody = (field, val) => {
  if (DATE_FIELDS.includes(field)) return [<Text key="d" style={styles.value}>1. {formatDate(val)}</Text>];
  if (isScalar(val)) {
    if (typeof val === 'string') {
      const rows = sentenceRows(safeString(val));
      return rows.length > 1
        ? rows.map((r, i) => r.type === 'subtitle'
          ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
          : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
        : [<Text key="s" style={styles.value}>1. {safeString(val)}</Text>];
    }
    return [<Text key="n" style={styles.value}>1. {safeString(fmtScalar(val))}</Text>];
  }
  if (Array.isArray(val)) {
    const items = val.filter(x => !isEmptyDeep(x));
    if (items.every(isScalar)) return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>);
    const out = [];
    items.forEach((it, i) => {
      if (isScalar(it)) out.push(<Text key={'s' + i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>);
      else objectRows(it, 'o' + i).forEach(r => out.push(r));
    });
    return out;
  }
  return objectRows(val, 'obj');
};

const fieldPresent = (record, field) => hasVal(resolvePath(record, field));

const renderField = (record, field, sectionTitle, isFirst) => {
  if (!fieldPresent(record, field)) return [];
  const val = resolvePath(record, field);
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {fieldBody(field, val)}
    </View>
  )];
};

const HematologyAssessmentDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.hematology_assessment) records = Array.isArray(data[0].hematology_assessment) ? data[0].hematology_assessment : [data[0].hematology_assessment];
    else records = data;
  } else if (data?.hematology_assessment) records = Array.isArray(data.hematology_assessment) ? data.hematology_assessment : [data.hematology_assessment];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.hematology_assessment) records = Array.isArray(dd.hematology_assessment) ? dd.hematology_assessment : [dd.hematology_assessment]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Hematology Assessment</Text></View>
        <Text style={styles.emptyState}>No hematology assessment records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Hematology Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Hematology Assessment ${idx + 1}`}</Text>
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

export default HematologyAssessmentDocumentPDFTemplate;
