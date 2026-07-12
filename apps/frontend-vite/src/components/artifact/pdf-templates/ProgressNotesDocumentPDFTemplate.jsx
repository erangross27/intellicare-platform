/**
 * ProgressNotesDocumentPDFTemplate.jsx
 * March 2026 — Box-free — Helvetica LETTER — black on white — underlined bare labels
 * Collection: progress_notes
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ═══════ BOX-FREE PDF STYLES ═══════ */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', marginBottom: 14 },
  recordCard: { marginBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', marginTop: 6, marginBottom: 10 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', marginTop: 8, marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', marginTop: 6, marginBottom: 2 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 14, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 2 },
});

/* ═══════ CONFIG (mirrors ProgressNotesDocument.jsx) ═══════ */
const SECTION_TITLES = {
  'chief-complaint-history': 'Chief Complaint and History',
  'vital-signs-examination': 'Vital Signs and Examination',
  'medications': 'Medications',
  'laboratory-imaging': 'Laboratory and Imaging',
  'status-assessment': 'Status Assessment',
  'plan-interventions': 'Plan and Interventions',
  'social-factors': 'Social Factors',
};

const FIELD_LABELS = {
  chiefComplaint: 'Chief Complaint',
  historyOfPresentIllness: 'History of Present Illness',
  vitalSigns: 'Vital Signs',
  painScale: 'Pain Scale',
  glasgowComaScale: 'Glasgow Coma Scale',
  physicalExamination: 'Physical Examination',
  medicationChanges: 'Medication Changes',
  currentMedications: 'Current Medications',
  allergiesAndReactions: 'Allergies and Reactions',
  laboratoryValues: 'Laboratory Values',
  imagingFindings: 'Imaging Findings',
  functionalStatus: 'Functional Status',
  respiratoryStatus: 'Respiratory Status',
  cardiovascularStatus: 'Cardiovascular Status',
  neurologicalStatus: 'Neurological Status',
  woundAssessment: 'Wound Assessment',
  nutritionalStatus: 'Nutritional Status',
  fluidBalance: 'Fluid Balance',
  infectionStatus: 'Infection Status',
  dischargePlanning: 'Discharge Planning',
  patientEducation: 'Patient Education',
  interventionsPerformed: 'Interventions Performed',
  socialFactors: 'Social Factors',
  clinicalStability: 'Clinical Stability',
};

const SECTION_FIELDS = {
  'chief-complaint-history': ['chiefComplaint', 'historyOfPresentIllness'],
  'vital-signs-examination': ['vitalSigns', 'painScale', 'glasgowComaScale', 'physicalExamination'],
  'medications': ['medicationChanges', 'currentMedications', 'allergiesAndReactions'],
  'laboratory-imaging': ['laboratoryValues', 'imagingFindings'],
  'status-assessment': ['functionalStatus', 'respiratoryStatus', 'cardiovascularStatus', 'neurologicalStatus', 'woundAssessment', 'nutritionalStatus', 'fluidBalance', 'infectionStatus'],
  'plan-interventions': ['dischargePlanning', 'patientEducation', 'interventionsPerformed'],
  'social-factors': ['socialFactors', 'clinicalStability'],
};

const BOOLEAN_FIELDS = ['clinicalStability'];
const NUMBER_FIELDS = ['painScale', 'glasgowComaScale'];
const MEANINGFUL_ZERO_FIELDS = ['painScale'];
const ARRAY_FIELDS = ['currentMedications', 'allergiesAndReactions', 'interventionsPerformed'];
const COMMA_SPLIT_FIELDS = ['patientEducation'];

/* ═══════ HELPERS ═══════ */
const safeString = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
};

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const flattenItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && !Array.isArray(item)) {
    const main = item.value || item.text || item.name || '';
    if (main) return String(main);
    return Object.entries(item).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => `${k}: ${v}`).join(', ');
  }
  return String(item);
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();
const isHiddenZero = (fn, val) => NUMBER_FIELDS.includes(fn) && Number(val) === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fn);
const shouldCommaSplit = (fn, strVal) => COMMA_SPLIT_FIELDS.includes(fn) && splitBySentence(strVal).length <= 1 && !parseLabel(strVal).isLabeled && splitByComma(strVal).length >= 2;

/* formatSentenceLines: mirrors JSX formatSentenceFieldLines */
const formatSentenceLines = (text) => {
  const sentences = splitBySentence(text);
  const out = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        out.push({ sub: parsed.label });
        parts.forEach(item => out.push({ item: `${n++}. ${item}` }));
      } else { out.push({ sub: parsed.label }); out.push({ item: `${n++}. ${parsed.value}` }); }
    } else { out.push({ item: `${n++}. ${s}` }); }
  });
  return out;
};

const fieldHasVal = (fn, val) => {
  if (isHiddenZero(fn, val)) return false;
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return Number.isFinite(val);
  if (typeof val === 'string') return val.trim() !== '';
  if (Array.isArray(val)) return val.filter(x => !isEmptyDeep(x)).length > 0;
  if (typeof val === 'object') return Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).length > 0;
  return true;
};

/* fieldBody: FLAT array of Text elements for one field (bare label + body rows) */
const fieldBody = (fn, val, sid) => {
  const label = FIELD_LABELS[fn] || fn;
  const els = [];
  if (!sameAsTitle(label, sid)) els.push(<Text style={styles.fieldLabel}>{safeString(label)}</Text>);

  if (BOOLEAN_FIELDS.includes(fn) || NUMBER_FIELDS.includes(fn)) {
    els.push(<Text style={styles.value}>{safeString(fmtScalar(val))}</Text>);
  } else if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x)).map(flattenItem).filter(s => s && s.trim());
    items.forEach((item, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>));
  } else {
    const strVal = fmtScalar(val);
    if (shouldCommaSplit(fn, strVal)) {
      splitByComma(strVal).forEach((p, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(p)}`}</Text>));
    } else {
      const sentences = splitBySentence(strVal);
      if (sentences.length > 1 || parseLabel(strVal).isLabeled) {
        formatSentenceLines(strVal).forEach(line => {
          if (line.sub !== undefined) els.push(<Text style={styles.subLabel}>{safeString(line.sub)}</Text>);
          else els.push(<Text style={styles.listItem}>{safeString(line.item)}</Text>);
        });
      } else {
        els.push(<Text style={styles.value}>{safeString(strVal)}</Text>);
      }
    }
  }
  return els;
};

/* renderSection: FLATTEN — glue sectionTitle + first body element in a wrap={false} View, rest flow */
const renderSection = (record, sid, ridx) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const bodyEls = [];
  fields.forEach(fn => { const val = record[fn]; if (fieldHasVal(fn, val)) fieldBody(fn, val, sid).forEach(el => bodyEls.push(el)); });
  if (bodyEls.length === 0) return null;

  const first = bodyEls[0];
  const rest = bodyEls.slice(1);
  return (
    <View key={`${sid}-${ridx}`} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {React.cloneElement(first, { key: 'f0' })}
      </View>
      {rest.map((el, i) => React.cloneElement(el, { key: `f${i + 1}` }))}
    </View>
  );
};

/* ═══════ DATA UNWRAP ═══════ */
const unwrapData = (rawData) => {
  if (!rawData) return [];
  let arr = Array.isArray(rawData) ? rawData : [rawData];
  arr = arr.flatMap(r => {
    if (r?.progress_notes) return Array.isArray(r.progress_notes) ? r.progress_notes : [r.progress_notes];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.progress_notes) return Array.isArray(dd.progress_notes) ? dd.progress_notes : [dd.progress_notes]; return [dd]; }
    if (r?._records && Array.isArray(r._records)) return r._records;
    if (r?.records && Array.isArray(r.records)) return r.records;
    return [r];
  });
  return arr.filter(r => r && typeof r === 'object');
};

const ProgressNotesDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Progress Notes</Text>
          <Text style={styles.value}>No progress notes records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Progress Notes</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard} break={idx > 0}>
            <Text style={styles.recordTitle}>Progress Note {idx + 1}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid, idx))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ProgressNotesDocumentPDFTemplate;
