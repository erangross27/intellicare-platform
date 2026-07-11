/**
 * PancreasTransplantEvaluationDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) - mirrors the JSX: title-only header (no record date),
 * sentinel-zero hide (a 0-valued score/measure is the extractor's unset default -> HIDDEN, memory 6a4fa368),
 * number fields, string arrays numbered, narrative strings sentence-split ([.;] with abbrev/single-initial
 * guard + labeled comma-split), boolean rendered Yes/No, single-name label gate. Rule #74: each field is ONE
 * wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's View. Static PHI footer.
 * safeString uses ONLY \uXXXX escapes (ASCII-only source). Collection: pancreas_transplant_evaluation.
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

const SECTION_ORDER = ['diabetes-overview', 'hypoglycemia', 'complications', 'transplant-category', 'cardiac-vascular', 'immunology', 'infection-screening'];
const SECTION_TITLES = {
  'diabetes-overview': 'Diabetes Overview',
  'hypoglycemia': 'Hypoglycemia Assessment',
  'complications': 'Diabetes Complications',
  'transplant-category': 'Transplant Category',
  'cardiac-vascular': 'Cardiac & Vascular Assessment',
  'immunology': 'Immunology',
  'infection-screening': 'Infection Screening',
};
const FIELD_LABELS = {
  primaryIndicationDiabetesType: 'Primary Indication / Diabetes Type',
  cPeptideLevel: 'C-Peptide Level (ng/mL)',
  hemoglobinA1c: 'HbA1c (%)',
  diabetesDurationYears: 'Diabetes Duration (years)',
  insulinRequirementTotalDailyDose: 'Insulin Requirement (TDD units)',
  hypoglycemicUnawarenessScore: 'Hypoglycemic Unawareness Score',
  ryanHypoglycemiaSeverityScore: 'Ryan Hypoglycemia Severity Score',
  diabetesComplications: 'Diabetes Complications',
  estimatedGFR: 'Estimated GFR (mL/min)',
  autonomicNeuropathyAssessment: 'Autonomic Neuropathy Assessment',
  gastroparesisGastricEmptyingTime: 'Gastroparesis Gastric Emptying Time (min)',
  transplantCategory: 'Transplant Category',
  previousKidneyTransplant: 'Previous Kidney Transplant',
  cardiacStressTestResult: 'Cardiac Stress Test Result',
  coronaryAngiographyFindings: 'Coronary Angiography Findings',
  leftVentricularEjectionFraction: 'LVEF (%)',
  iliacArteryDuplexFindings: 'Iliac Artery Duplex Findings',
  aortoiliacCalcificationScore: 'Aortoiliac Calcification Score',
  bmi: 'BMI (kg/m2)',
  panelReactiveAntibodyPercentage: 'Panel Reactive Antibody (%)',
  hlaTyping: 'HLA Typing',
  donorSpecificAntibodies: 'Donor Specific Antibodies',
  activeInfectionScreening: 'Active Infection Screening',
};
const SECTION_FIELDS = {
  'diabetes-overview': ['primaryIndicationDiabetesType', 'cPeptideLevel', 'hemoglobinA1c', 'diabetesDurationYears', 'insulinRequirementTotalDailyDose'],
  'hypoglycemia': ['hypoglycemicUnawarenessScore', 'ryanHypoglycemiaSeverityScore'],
  'complications': ['diabetesComplications', 'estimatedGFR', 'autonomicNeuropathyAssessment', 'gastroparesisGastricEmptyingTime'],
  'transplant-category': ['transplantCategory', 'previousKidneyTransplant'],
  'cardiac-vascular': ['cardiacStressTestResult', 'coronaryAngiographyFindings', 'leftVentricularEjectionFraction', 'iliacArteryDuplexFindings', 'aortoiliacCalcificationScore', 'bmi'],
  'immunology': ['panelReactiveAntibodyPercentage', 'hlaTyping', 'donorSpecificAntibodies'],
  'infection-screening': ['activeInfectionScreening'],
};
const NUMBER_FIELDS = [
  'cPeptideLevel', 'hemoglobinA1c', 'diabetesDurationYears', 'insulinRequirementTotalDailyDose',
  'hypoglycemicUnawarenessScore', 'ryanHypoglycemiaSeverityScore', 'estimatedGFR',
  'gastroparesisGastricEmptyingTime', 'leftVentricularEjectionFraction',
  'aortoiliacCalcificationScore', 'bmi', 'panelReactiveAntibodyPercentage',
];
const HIDE_ZERO_FIELDS = NUMBER_FIELDS;
const STRING_FIELDS = [
  'primaryIndicationDiabetesType', 'transplantCategory', 'cardiacStressTestResult',
  'coronaryAngiographyFindings', 'iliacArteryDuplexFindings', 'hlaTyping',
  'autonomicNeuropathyAssessment', 'activeInfectionScreening',
];
const ARRAY_FIELDS = ['diabetesComplications', 'donorSpecificAntibodies'];

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
const hasFieldVal = (fn, v) => { if (!hasVal(v)) return false; if (HIDE_ZERO_FIELDS.includes(fn) && Number(v) === 0) return false; return true; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* safeString: fold common non-ASCII glyphs to ASCII via a numeric code-point map (no regex, no literal
   glyphs) so the file source stays PURE ASCII and never trips "Unterminated regular expression". */
const SAFE_MAP = {
  0x2018: "'", 0x2019: "'", 0x201B: "'", 0x201C: '"', 0x201D: '"',
  0x2013: '-', 0x2014: '-', 0x2026: '...', 0x00B5: 'u', 0x03BC: 'u',
  0x00B0: ' deg', 0x00B1: '+/-', 0x2265: '>=', 0x2264: '<=',
  0x2192: '->', 0x2190: '<-', 0x00D7: 'x', 0x00F7: '/', 0x2022: '-', 0x00A0: ' ',
};
const SAFE_DROP = new Set([
  0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008,
  0x000B, 0x000C, 0x000E, 0x000F, 0x0010, 0x0011, 0x0012, 0x0013, 0x0014,
  0x0015, 0x0016, 0x0017, 0x0018, 0x0019, 0x001A, 0x001B, 0x001C, 0x001D,
  0x001E, 0x001F, 0x2028, 0x2029, 0xFEFF,
]);
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  const s = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const cp = s.charCodeAt(i);
    if (SAFE_DROP.has(cp)) continue;
    if (SAFE_MAP[cp] !== undefined) { out += SAFE_MAP[cp]; continue; }
    out += s[i];
  }
  return out;
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
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
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>)}
      </View>
    )];
  }

  let body;
  if (STRING_FIELDS.includes(f)) {
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

const PancreasTransplantEvaluationDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].pancreas_transplant_evaluation && Array.isArray(templateData[0].pancreas_transplant_evaluation)) records = templateData[0].pancreas_transplant_evaluation;
    else records = templateData;
  } else if (templateData && templateData.pancreas_transplant_evaluation) {
    records = Array.isArray(templateData.pancreas_transplant_evaluation) ? templateData.pancreas_transplant_evaluation : [templateData.pancreas_transplant_evaluation];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.pancreas_transplant_evaluation ? (Array.isArray(dd.pancreas_transplant_evaluation) ? dd.pancreas_transplant_evaluation : [dd.pancreas_transplant_evaluation]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Pancreas Transplant Evaluation</Text></View>
        <Text style={styles.emptyState}>No pancreas transplant evaluation records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Pancreas Transplant Evaluation</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Pancreas Transplant Evaluation ${idx + 1}`}</Text>
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

export default PancreasTransplantEvaluationDocumentPDFTemplate;
