import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * OccupationalTherapyReportsDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders for JSX/PDF field parity.
 * No boxes: underline rules only (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5).
 * Generic recursive: dotted-path fields (resolvePath), nested objects (adlAssessment/cognitiveAssessment/
 * fineMotorSkills/sensoryAssessment) flattened box-free via objectRows, top-level string arrays and the
 * nested treatmentPlan.interventions array numbered under their (sub)label. Record date is evaluationDate
 * (a real field) - NEVER createdAt/updatedAt. safeString uses \uXXXX escapes ONLY.
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
const SECTION_ORDER = ['evaluation-info', 'adl-assessment', 'cognitive-assessment', 'sensory-assessment', 'fine-motor', 'adaptive-equipment', 'home-modifications', 'treatment-plan', 'goals'];

const SECTION_TITLES = {
  'evaluation-info': 'Evaluation Information',
  'adl-assessment': 'ADL Assessment',
  'cognitive-assessment': 'Cognitive Assessment',
  'sensory-assessment': 'Sensory Assessment',
  'fine-motor': 'Fine Motor Skills',
  'adaptive-equipment': 'Adaptive Equipment',
  'home-modifications': 'Home Modifications',
  'treatment-plan': 'Treatment Plan',
  'goals': 'Goals',
};

const FIELD_LABELS = {
  evaluationDate: 'Evaluation Date',
  therapist: 'Therapist',
  referralDiagnosis: 'Referral Diagnosis',
  'adlAssessment.dressing': 'Dressing',
  'adlAssessment.bathing': 'Bathing',
  'adlAssessment.cooking': 'Cooking',
  'adlAssessment.driving': 'Driving',
  'cognitiveAssessment.executiveFunction': 'Executive Function',
  'cognitiveAssessment.processingSpeed': 'Processing Speed',
  'cognitiveAssessment.memory': 'Memory',
  sensoryAssessment: 'Sensory Assessment',
  'fineMotorSkills.status': 'Status',
  'fineMotorSkills.gripStrength': 'Grip Strength',
  'fineMotorSkills.wristExtension': 'Wrist Extension',
  'treatmentPlan.frequency': 'Frequency',
  'treatmentPlan.duration': 'Duration',
  'treatmentPlan.interventions': 'Interventions',
  adaptiveEquipment: 'Adaptive Equipment',
  homeModifications: 'Home Modifications',
  goals: 'Goals',
};

const SECTION_FIELDS = {
  'evaluation-info': ['evaluationDate', 'therapist', 'referralDiagnosis'],
  'adl-assessment': ['adlAssessment.dressing', 'adlAssessment.bathing', 'adlAssessment.cooking', 'adlAssessment.driving'],
  'cognitive-assessment': ['cognitiveAssessment.executiveFunction', 'cognitiveAssessment.processingSpeed', 'cognitiveAssessment.memory'],
  'sensory-assessment': ['sensoryAssessment'],
  'fine-motor': ['fineMotorSkills.status', 'fineMotorSkills.gripStrength', 'fineMotorSkills.wristExtension'],
  'adaptive-equipment': ['adaptiveEquipment'],
  'home-modifications': ['homeModifications'],
  'treatment-plan': ['treatmentPlan.frequency', 'treatmentPlan.duration', 'treatmentPlan.interventions'],
  'goals': ['goals'],
};

const NUMBER_FIELDS = [];
const DATE_FIELDS = ['evaluationDate'];

/* HELPERS (mirror the JSX) - safeString uses \uXXXX escapes ONLY (never literal smart-quotes/invisible chars) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const resolvePath = (obj, path) => { if (!obj || !path) return undefined; return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj); };

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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v == null ? '' : v); };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
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
   comma items into their own sub-label (mirrors the JSX decomposition; never side-by-side). */
const sentenceRows = (text) => {
  const rows = [];
  splitBySentence(text).forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) {
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

/* Top-level value -> rows for one field */
const fieldBody = (field, val) => {
  if (DATE_FIELDS.includes(field)) return [<Text key="d" style={styles.value}>{safeString(formatDate(val))}</Text>];
  if (NUMBER_FIELDS.includes(field)) return [<Text key="n" style={styles.value}>{safeString(String(val))}</Text>];
  if (isScalar(val)) {
    if (typeof val === 'string') {
      const rows = sentenceRows(val);
      if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(val)}</Text>];
      return rows.map((r, i) => r.type === 'sub'
        ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
        : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
    }
    return [<Text key="s" style={styles.value}>{safeString(fmtScalar(val))}</Text>];
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

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(resolvePath(record, f)));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return present.map((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    return (
      <View key={f} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {fieldBody(f, resolvePath(record, f))}
      </View>
    );
  });
};

const OccupationalTherapyReportsDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.occupational_therapy_reports) records = Array.isArray(data[0].occupational_therapy_reports) ? data[0].occupational_therapy_reports : [data[0].occupational_therapy_reports];
    else records = data;
  } else if (data?.occupational_therapy_reports) records = Array.isArray(data.occupational_therapy_reports) ? data.occupational_therapy_reports : [data.occupational_therapy_reports];
  else if (data && typeof data === 'object') records = [data];
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Occupational Therapy Reports</Text>
          <Text style={styles.noData}>No occupational therapy reports records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Occupational Therapy Reports</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`Occupational Therapy Report ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default OccupationalTherapyReportsDocumentPDFTemplate;
