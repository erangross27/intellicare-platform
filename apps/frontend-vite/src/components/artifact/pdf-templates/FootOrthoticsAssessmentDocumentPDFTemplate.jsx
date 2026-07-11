/**
 * FootOrthoticsAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: NO clinical date in schema (never render
 * createdAt), values numbered ('1.' even singles), single-name label gate, per-field sentinel-zero hiding
 * (archHeightIndex 0 = not measured), narratives split on [.;] (labeled → sub-label + numbered comma items),
 * string arrays numbered. safeString scrubs non-Latin-1 glyphs Helvetica can't draw. Rule #74: each field is ONE
 * wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's View. Static PHI footer.
 * Collection: foot_orthotics_assessment.
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

const SECTION_ORDER = ['weight-bearing-gait', 'biomechanical-assessment', 'clinical-tests', 'alignment-pressure', 'orthotic-prescription', 'risk-category'];
const SECTION_TITLES = {
  'weight-bearing-gait': 'Weight Bearing & Gait',
  'biomechanical-assessment': 'Biomechanical Assessment',
  'clinical-tests': 'Clinical Tests',
  'alignment-pressure': 'Alignment & Pressure',
  'orthotic-prescription': 'Orthotic Prescription',
  'risk-category': 'Risk Category',
};
const FIELD_LABELS = {
  patientWeightBearing: 'Weight Bearing Status', gaitCycleAbnormalities: 'Gait Cycle Abnormalities',
  rearfootAlignment: 'Rearfoot Alignment', forefootToRearfootRelationship: 'Forefoot-to-Rearfoot Relationship',
  subtalarJointROM: 'Subtalar Joint ROM', firstMTPJointROM: '1st MTP Joint ROM',
  ankleJointDorsiflexion: 'Ankle Joint Dorsiflexion', archHeightIndex: 'Arch Height Index',
  footPostureIndex: 'Foot Posture Index', naviularDropTest: 'Navicular Drop Test',
  tibialVarumAngle: 'Tibial Varum Angle', legLengthDiscrepancy: 'Leg Length Discrepancy',
  tooManyToesSign: 'Too Many Toes Sign', jackTest: 'Jack Test', singleHeelRiseTest: 'Single Heel Rise Test',
  colemanBlockTest: 'Coleman Block Test', metatarsalPhalangealAlignment: 'Metatarsalphalangeal Alignment',
  plantarPressureDistribution: 'Plantar Pressure Distribution', orthoticDeviceType: 'Orthotic Device Type',
  orthoticShellMaterial: 'Orthotic Shell Material', medialArchSupport: 'Medial Arch Support',
  metatarsalModifications: 'Metatarsal Modifications', rearfootPosting: 'Rearfoot Posting',
  forefootPosting: 'Forefoot Posting', diabeticFootRiskCategory: 'Diabetic Foot Risk Category',
};
const SECTION_FIELDS = {
  'weight-bearing-gait': ['patientWeightBearing', 'gaitCycleAbnormalities'],
  'biomechanical-assessment': ['rearfootAlignment', 'forefootToRearfootRelationship', 'subtalarJointROM', 'firstMTPJointROM', 'ankleJointDorsiflexion', 'archHeightIndex', 'footPostureIndex', 'naviularDropTest', 'tibialVarumAngle', 'legLengthDiscrepancy'],
  'clinical-tests': ['tooManyToesSign', 'jackTest', 'singleHeelRiseTest', 'colemanBlockTest'],
  'alignment-pressure': ['metatarsalPhalangealAlignment', 'plantarPressureDistribution'],
  'orthotic-prescription': ['orthoticDeviceType', 'orthoticShellMaterial', 'medialArchSupport', 'metatarsalModifications', 'rearfootPosting', 'forefootPosting'],
  'risk-category': ['diabeticFootRiskCategory'],
};
const NUMBER_FIELDS = ['firstMTPJointROM', 'ankleJointDorsiflexion', 'archHeightIndex', 'footPostureIndex', 'naviularDropTest', 'legLengthDiscrepancy', 'tibialVarumAngle'];
const HIDE_ZERO_FIELDS = ['archHeightIndex'];
const ARRAY_FIELDS = ['gaitCycleAbnormalities', 'metatarsalModifications'];

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasFieldVal = (fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && v === 0) return false; return !isEmptyDeep(v); };
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[×✕✖]/g, 'x').replace(/÷/g, '/')
    .replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
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

/* mirror the JSX/copy: multi-sentence → labeled sub-group (subLabel + numbered comma items) or numbered unlabeled row */
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

/* Rule #74: render a field as ONE wrap={false} atomic View; sectionTitle rides inside the first present field's View. */
const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (!hasFieldVal(f, val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  let body;
  if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(val)}</Text>;
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    body = items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>);
  } else {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const FootOrthoticsAssessmentDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].foot_orthotics_assessment && Array.isArray(templateData[0].foot_orthotics_assessment)) records = templateData[0].foot_orthotics_assessment;
    else records = templateData;
  } else if (templateData && templateData.foot_orthotics_assessment) {
    records = Array.isArray(templateData.foot_orthotics_assessment) ? templateData.foot_orthotics_assessment : [templateData.foot_orthotics_assessment];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.foot_orthotics_assessment ? (Array.isArray(dd.foot_orthotics_assessment) ? dd.foot_orthotics_assessment : [dd.foot_orthotics_assessment]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Foot Orthotics Assessment</Text></View>
        <Text style={styles.emptyState}>No foot orthotics assessment records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Foot Orthotics Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Foot Orthotics Assessment ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasFieldVal(f, record[f]));
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

export default FootOrthoticsAssessmentDocumentPDFTemplate;
