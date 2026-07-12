import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PreOperativeAssessmentsDocumentPDFTemplate — box-free B&W LETTER rewrite
 * Config-driven mirror of PreOperativeAssessmentsDocument.jsx (section-driven flat).
 * Bare underlined field labels above stacked values; anti-orphan glue (section
 * title + first field kept together). No record date is keyed off createdAt/updatedAt —
 * assessmentDate/scheduledSurgeryDate render in-section like the JSX.
 */

/* ═══════ CONFIG (mirrors the JSX) ═══════ */
const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'medical-surgical': 'Medical & Surgical History',
  'clinical-status': 'Clinical Status',
  'organ-function': 'Organ Function',
  'anesthesia-plan': 'Anesthesia Plan',
  'testing-risk': 'Testing & Risk Stratification',
  'clearance-special': 'Clearance & Special Considerations',
  'recommendations-section': 'Recommendations',
};

const FIELD_LABELS = {
  assessmentDate: 'Assessment Date',
  scheduledSurgeryDate: 'Scheduled Surgery Date',
  plannedProcedure: 'Planned Procedure',
  preOpDiagnosis: 'Pre-Op Diagnosis',
  medicalHistory: 'Medical History',
  surgicalHistory: 'Surgical History',
  currentMedications: 'Current Medications',
  allergies: 'Allergies',
  asaClass: 'ASA Class',
  functionalStatus: 'Functional Status',
  cardiovascularRisk: 'Cardiovascular Risk',
  pulmonaryRisk: 'Pulmonary Risk',
  airwayAssessment: 'Airway Assessment',
  renalFunction: 'Renal Function',
  hepaticFunction: 'Hepatic Function',
  coagulationStatus: 'Coagulation Status',
  anesthesiaType: 'Anesthesia Type',
  npoStatus: 'NPO Status',
  preOpTesting: 'Pre-Op Testing',
  riskStratification: 'Risk Stratification',
  clearance: 'Clearance',
  specialConsiderations: 'Special Considerations',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'assessment-info': ['assessmentDate', 'scheduledSurgeryDate', 'plannedProcedure', 'preOpDiagnosis'],
  'medical-surgical': ['medicalHistory', 'surgicalHistory', 'currentMedications', 'allergies'],
  'clinical-status': ['asaClass', 'functionalStatus', 'cardiovascularRisk', 'pulmonaryRisk', 'airwayAssessment'],
  'organ-function': ['renalFunction', 'hepaticFunction', 'coagulationStatus'],
  'anesthesia-plan': ['anesthesiaType', 'npoStatus'],
  'testing-risk': ['preOpTesting', 'riskStratification'],
  'clearance-special': ['clearance', 'specialConsiderations'],
  'recommendations-section': ['recommendations'],
};

const DATE_FIELDS = ['assessmentDate', 'scheduledSurgeryDate'];
const ARRAY_FIELDS = ['recommendations'];
const COMMA_SPLIT_FIELDS = ['preOpDiagnosis', 'medicalHistory', 'surgicalHistory', 'currentMedications'];

const sameAsTitle = (label, sid) => (SECTION_TITLES[sid] || '') === label;

/* ═══════ HELPERS (mirror the JSX) ═══════ */
const filterNulls = (arr) => (Array.isArray(arr) ? arr.filter(item => item !== null && item !== undefined) : []);

// Scrub glyphs Helvetica cannot render (multiplication sign → x, smart quotes/dashes → ascii).
const safeString = (v) => {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/×/g, 'x')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[​‌‍﻿]/g, '');
};

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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const shouldCommaSplit = (v) => {
  const s = String(v || '');
  return !parseLabel(s).isLabeled && splitBySentence(s).length <= 1 && splitByComma(s).length >= 2;
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const formatDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date.$date || date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(date); }
};

const getRecText = (rec) => {
  if (typeof rec === 'string') return rec;
  if (rec && typeof rec === 'object' && rec.recommendation) return rec.recommendation;
  return '';
};

/* ═══════ STYLES (box-free) ═══════ */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#FFFFFF' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 18, marginBottom: 8 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 3 },
  value: { fontSize: 14, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 2, marginLeft: 12 },
  divider: { marginTop: 14, marginBottom: 14, borderBottomWidth: 0.5, borderBottomColor: '#cccccc' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 9, color: '#666666' },
});

/* Build the value elements for a STRING field (mirrors formatSentenceFieldLines numbering) */
function stringValueElements(strVal, keyPrefix) {
  const sentences = splitBySentence(strVal);
  const wholeParsed = parseLabel(strVal);
  const structured = sentences.length > 1 || (wholeParsed.isLabeled && splitByComma(wholeParsed.value).length >= 2);
  if (!structured) {
    return [<Text key={`${keyPrefix}-v`} style={styles.value}>{safeString(strVal)}</Text>];
  }
  const els = []; let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      els.push(<Text key={`${keyPrefix}-s${si}-l`} style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>);
      if (items.length >= 2) {
        items.forEach((it, ii) => els.push(<Text key={`${keyPrefix}-s${si}-i${ii}`} style={styles.listItem}>{n++}. {safeString(it)}</Text>));
      } else {
        els.push(<Text key={`${keyPrefix}-s${si}-v`} style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>);
      }
    } else {
      els.push(<Text key={`${keyPrefix}-s${si}`} style={styles.listItem}>{n++}. {safeString(s)}</Text>);
    }
  });
  return els;
}

/* Render a single field → a <View> block (bare label + stacked value), or null when empty */
function renderField(record, fn, sid, keyPrefix) {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const labelEl = sameAsTitle(label, sid) ? null : <Text style={styles.fieldLabel}>{safeString(label)}</Text>;

  if (DATE_FIELDS.includes(fn)) {
    return (
      <View key={keyPrefix} style={styles.fieldBox}>
        {labelEl}
        <Text style={styles.value}>{safeString(formatDate(val))}</Text>
      </View>
    );
  }

  if (ARRAY_FIELDS.includes(fn)) {
    const items = filterNulls(Array.isArray(val) ? val : [val]).map(getRecText).filter(Boolean);
    if (items.length === 0) return null;
    return (
      <View key={keyPrefix} style={styles.fieldBox}>
        {labelEl}
        {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>)}
      </View>
    );
  }

  const strVal = String(val);
  if (COMMA_SPLIT_FIELDS.includes(fn) && shouldCommaSplit(strVal)) {
    const parts = splitByComma(strVal);
    return (
      <View key={keyPrefix} style={styles.fieldBox}>
        {labelEl}
        {parts.map((p, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(p)}</Text>)}
      </View>
    );
  }

  return (
    <View key={keyPrefix} style={styles.fieldBox}>
      {labelEl}
      {stringValueElements(strVal, keyPrefix)}
    </View>
  );
}

/* Render a section with anti-orphan glue (title + first field kept together) */
function renderSection(record, sid, idx) {
  const fields = SECTION_FIELDS[sid] || [];
  const els = fields.map((f, fi) => renderField(record, f, sid, `${sid}-${idx}-${fi}`)).filter(Boolean);
  if (els.length === 0) return null;
  const title = SECTION_TITLES[sid];
  const [first, ...rest] = els;
  return (
    <View key={sid} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(title)}</Text>
        {first}
      </View>
      {rest.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </View>
  );
}

const PreOperativeAssessmentsDocumentPDFTemplate = ({ document: data }) => {
  const records = filterNulls(Array.isArray(data) ? data : [data]);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pre-Operative Assessments</Text>

        {records.map((record, idx) => (
          <View key={idx}>
            <Text style={styles.recordTitle}>Pre-Operative Assessment {idx + 1}</Text>
            {Object.keys(SECTION_TITLES).map(sid => renderSection(record, sid, idx))}
            {idx < records.length - 1 && <View style={styles.divider} />}
          </View>
        ))}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default PreOperativeAssessmentsDocumentPDFTemplate;
