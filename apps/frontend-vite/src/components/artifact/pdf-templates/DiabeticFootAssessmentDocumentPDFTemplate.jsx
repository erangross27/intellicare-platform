/**
 * DiabeticFootAssessmentDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: diabetic_foot_assessment.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel & subLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only; sub-labels glue with their first row; the section title rides
 * inside the FIRST glue unit. Every value row numbered ("1." even singles). Mirrors the JSX:
 * sentinel zeros hidden (Wagner grade 0 stays), comma-list fields split (paren-aware; the
 * monofilament field splits on ';' + sentences), "<LEVEL> - factors" fields get a level
 * sub-label, multi-sentence fields split with labeled-group restart numbering.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* mirrors the JSX field semantics */
const NUMBER_FIELDS = ['diabetesDurationYears', 'hemoglobinA1cPercent', 'wagnerUlcerGrade', 'sinbadScore', 'pedestalScore', 'ankleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure', 'vibrationPerceptionThreshold', 'michiganNeuropathyScore'];
const BOOLEAN_FIELDS = ['charcotFootPresence', 'osteomyelitisProbeToTest'];
const ARRAY_FIELDS = ['footDeformityPresent', 'priorAmputationHistory'];
const HIDE_ZERO_FIELDS = NUMBER_FIELDS.filter(f => f !== 'wagnerUlcerGrade');
const fieldShows = (fn, v) => hasVal(v) && !(typeof v === 'number' && v === 0 && HIDE_ZERO_FIELDS.includes(fn));

const RISK_PREFIX_FIELDS = new Set(['wifiLimbSalvageScore', 'infectionSeverityIdsa']);
const COMMA_LIST_FIELDS = new Set(['dorsalisPedisPulseStatus', 'posteriorTibialPulseStatus', 'monofilamentTestResult', 'ulcerLocationAnatomic', 'woundBedTissueType']);

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
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
      const rest = text.slice(i + 1);
      const nextTrim = rest.trimStart();
      const noSpace = rest.charAt(0) !== ' ';
      const andOr = /(?:^|\s)(?:and|or)$/i.test(current.trimEnd()) || /^(?:and|or)\b/i.test(nextTrim);
      const badNext = !/^[A-Za-z0-9>(]/.test(nextTrim.charAt(0) || '');
      if (noSpace || andOr || badNext) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const parseWifiScore = (value) => {
  if (!value || typeof value !== 'string') return { label: null, items: [] };
  const m = value.match(/^(.{1,40}?)\s+[-–]\s+([\s\S]+)$/);
  const body = m ? m[2] : value;
  const items = splitByComma(body);
  return { label: m && items.length >= 2 ? m[1].trim() : null, items };
};

const splitBySemicolonSentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ';' && depth === 0) { if (cur.trim()) parts.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  const result = [];
  parts.forEach(p => { p.split(/\.\s+/).forEach(s => { const t = s.replace(/[;.]+$/, '').trim(); if (t) result.push(t); }); });
  return result;
};

const splitListField = (fn, text) => fn === 'monofilamentTestResult' ? splitBySemicolonSentence(text) : splitByComma(text);

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* rows for one string field, mirroring the JSX branches */
const stringFieldRows = (fn, strVal) => {
  const rows = [];
  if (RISK_PREFIX_FIELDS.has(fn)) {
    const { label: riskLabel, items } = parseWifiScore(strVal);
    if (items.length >= 2) {
      if (riskLabel) rows.push({ subLabel: riskLabel });
      items.forEach((it, i) => rows.push({ num: i + 1, text: it }));
      return rows;
    }
  }
  if (COMMA_LIST_FIELDS.has(fn)) {
    const items = splitListField(fn, strVal);
    if (items.length >= 2) {
      items.forEach((it, i) => rows.push({ num: i + 1, text: it }));
      return rows;
    }
  }
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1 && !COMMA_LIST_FIELDS.has(fn)) {
    let running = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
      if (!value) return;
      if (parsed.isLabeled) {
        const parts = splitByComma(value);
        rows.push({ subLabel: parsed.label });
        if (parts.length >= 2) parts.forEach((item, i) => rows.push({ num: i + 1, text: item }));
        else rows.push({ num: 1, text: value });
      } else {
        rows.push({ num: running++, text: value });
      }
    });
    return rows;
  }
  rows.push({ num: 1, text: strVal.replace(/[;.]+$/, '').trim() });
  return rows;
};

/* Group rows into glue units: a sub-label glues with its first row; the section title rides
   inside the FIRST unit. wrap is BOOLEAN only. */
const RowsSection = ({ title, rows }) => {
  if (!rows || rows.length === 0) return null;
  const units = [];
  rows.forEach(r => {
    if (r.subLabel !== undefined) { units.push({ label: r.subLabel, rows: [] }); return; }
    const last = units[units.length - 1];
    if (last && last.label !== null && last.rows.length === 0) { last.rows.push(r); return; }
    units.push({ label: null, rows: [r] });
  });
  return (
    <View style={styles.section}>
      {units.map((u, i) => (
        <View key={i} wrap={false} style={styles.fieldGroup}>
          {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {u.label !== null && <Text style={styles.subLabel}>{safeString(u.label)}</Text>}
          {u.rows.map((r, ri) => <Text key={ri} style={styles.value}>{`${r.num}. ${safeString(r.text)}`}</Text>)}
        </View>
      ))}
    </View>
  );
};

const SECTIONS = [
  ['Diabetes Overview', ['patientDiabetesType', 'diabetesDurationYears', 'hemoglobinA1cPercent']],
  ['Classification & Scores', ['wagnerUlcerGrade', 'universityOfTexasClassification', 'sinbadScore', 'pedestalScore', 'wifiLimbSalvageScore']],
  ['Vascular Assessment', ['ankleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure', 'dorsalisPedisPulseStatus', 'posteriorTibialPulseStatus']],
  ['Neuropathy Assessment', ['monofilamentTestResult', 'vibrationPerceptionThreshold', 'michiganNeuropathyScore', 'charcotFootPresence']],
  ['Wound Assessment', ['ulcerLocationAnatomic', 'ulcerDimensionsCm', 'woundBedTissueType', 'periWoundSkinCondition', 'infectionSeverityIdsa', 'osteomyelitisProbeToTest']],
  ['Foot Deformity & Offloading', ['footDeformityPresent', 'offloadingDevicePrescribed']],
  ['Amputation History', ['priorAmputationHistory']],
];

const FIELD_LABELS = {
  patientDiabetesType: 'Diabetes Type', diabetesDurationYears: 'Duration (Years)', hemoglobinA1cPercent: 'HbA1c (%)',
  wagnerUlcerGrade: 'Wagner Ulcer Grade', universityOfTexasClassification: 'UT Classification', sinbadScore: 'SINBAD Score', pedestalScore: 'PEDESTAL Score', wifiLimbSalvageScore: 'WIfI Limb Salvage Score',
  ankleBrachialIndex: 'Ankle-Brachial Index', toeBrachialIndex: 'Toe-Brachial Index', transcutaneousOxygenPressure: 'TcPO2 (mmHg)', dorsalisPedisPulseStatus: 'Dorsalis Pedis Pulse', posteriorTibialPulseStatus: 'Posterior Tibial Pulse',
  monofilamentTestResult: 'Monofilament Test', vibrationPerceptionThreshold: 'Vibration Perception Threshold', michiganNeuropathyScore: 'Michigan Neuropathy Score', charcotFootPresence: 'Charcot Foot',
  ulcerLocationAnatomic: 'Ulcer Location', ulcerDimensionsCm: 'Ulcer Dimensions (cm)', woundBedTissueType: 'Wound Bed Tissue', periWoundSkinCondition: 'Peri-Wound Skin', infectionSeverityIdsa: 'Infection Severity (IDSA)', osteomyelitisProbeToTest: 'Probe-to-Bone Test',
  footDeformityPresent: 'Foot Deformities', offloadingDevicePrescribed: 'Offloading Device', priorAmputationHistory: 'Prior Amputations',
};

const sectionRows = (record, fields) => {
  const rows = [];
  fields.forEach(f => {
    const val = record[f];
    if (!fieldShows(f, val)) return;
    rows.push({ subLabel: FIELD_LABELS[f] || f });
    if (BOOLEAN_FIELDS.includes(f)) rows.push({ num: 1, text: val ? 'Yes' : 'No' });
    else if (NUMBER_FIELDS.includes(f)) rows.push({ num: 1, text: String(val) });
    else if (ARRAY_FIELDS.includes(f)) (Array.isArray(val) ? val.filter(Boolean) : []).forEach((item, i) => rows.push({ num: i + 1, text: String(item) }));
    else stringFieldRows(f, fmtVal(val)).forEach(r => rows.push(r));
  });
  return rows;
};

/* ═══ COMPONENT ═══ */
const DiabeticFootAssessmentDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.diabetic_foot_assessment) return Array.isArray(r.diabetic_foot_assessment) ? r.diabetic_foot_assessment : [r.diabetic_foot_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetic_foot_assessment) return Array.isArray(dd.diabetic_foot_assessment) ? dd.diabetic_foot_assessment : [dd.diabetic_foot_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Diabetic Foot Assessment">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diabetic Foot Assessment</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document title="Diabetic Foot Assessment">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diabetic Foot Assessment</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Diabetic Foot Assessment ${idx + 1}`}</Text>
            </View>
            {SECTIONS.map(([title, fields]) => <RowsSection key={title} title={title} rows={sectionRows(record, fields)} />)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DiabeticFootAssessmentDocumentPDFTemplate;
