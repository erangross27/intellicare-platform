/**
 * PotentialTestingOutcomesDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — potential testing outcomes
 * Collection: potential_testing_outcomes
 * Box-free B&W underline theme (mirrors the JSX Copy All structure for parity).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#333333', marginTop: 40 },
});

/* ======= UTILS ======= */
const safeString = (v) => {
  if (v === null || v === undefined) return '';
  return String(v).replace(/×/g, 'x');
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* parseLabel — "Label: value" detection (digit-tolerant char class) */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitBySentence — split on '.'/';' + whitespace, guarding abbreviations, single-letter
   initials (Dr. R. Vashisht), and digits (5.8, "124; "); strip a leading "N. " marker. */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(s => s.replace(/^\d+\.\s+/, '').trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* splitByComma — parenthesis-aware; skip no-space commas (3,951) and year-leading commas. */
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

/* ======= SECTION CONFIG (mirror of the JSX maps) ======= */
const SECTION_TITLES = {
  'diagnostic-imaging': 'Diagnostic Imaging',
  'cardiac-testing': 'Cardiac Testing',
  'laboratory-panels': 'Laboratory Panels',
  'specialized-testing': 'Specialized Testing',
  'additional-studies': 'Additional Studies',
};

const FIELD_LABELS = {
  laboratoryValues: 'Laboratory Values',
  imagingFindings: 'Imaging Findings',
  boneDensitometry: 'Bone Densitometry',
  mammmographyResults: 'Mammography Results',
  electrocardiogramResults: 'Electrocardiogram Results',
  echocardiogramResults: 'Echocardiogram Results',
  stressTestResults: 'Stress Test Results',
  holterMonitorResults: 'Holter Monitor Results',
  cardiacEnzymes: 'Cardiac Enzymes',
  ankleBrachialIndex: 'Ankle Brachial Index',
  thyroidFunctionTests: 'Thyroid Function Tests',
  hemoglobinA1c: 'Hemoglobin A1c',
  liverFunctionPanel: 'Liver Function Panel',
  glomerularFiltrationRate: 'Glomerular Filtration Rate',
  urinalysisResults: 'Urinalysis Results',
  arterialBloodGas: 'Arterial Blood Gas',
  coagulationStudies: 'Coagulation Studies',
  pulmonaryFunctionTests: 'Pulmonary Function Tests',
  colonoscopyFindings: 'Colonoscopy Findings',
  pathologyReport: 'Pathology Report',
  microbiolgyResults: 'Microbiology Results',
  sleepStudyResults: 'Sleep Study Results',
  cerebrospinalFluidAnalysis: 'Cerebrospinal Fluid Analysis',
};

const SECTION_FIELDS = {
  'diagnostic-imaging': ['imagingFindings', 'boneDensitometry', 'mammmographyResults'],
  'cardiac-testing': ['electrocardiogramResults', 'echocardiogramResults', 'stressTestResults', 'holterMonitorResults', 'cardiacEnzymes', 'ankleBrachialIndex'],
  'laboratory-panels': ['laboratoryValues', 'thyroidFunctionTests', 'hemoglobinA1c', 'liverFunctionPanel', 'glomerularFiltrationRate', 'urinalysisResults', 'arterialBloodGas', 'coagulationStudies'],
  'specialized-testing': ['pulmonaryFunctionTests', 'colonoscopyFindings', 'pathologyReport', 'microbiolgyResults'],
  'additional-studies': ['sleepStudyResults', 'cerebrospinalFluidAnalysis'],
};

const NUMBER_FIELDS = ['ankleBrachialIndex', 'glomerularFiltrationRate', 'hemoglobinA1c'];
const ARRAY_FIELDS = ['laboratoryValues'];
const COMMA_SPLIT_FIELDS = ['electrocardiogramResults', 'echocardiogramResults', 'stressTestResults', 'holterMonitorResults'];

/* A number stored as 0 here means "not recorded" (ABI/GFR/A1c are physiologically impossible at 0). */
const isMeaninglessZero = (fn, v) => NUMBER_FIELDS.includes(fn) && (v === 0 || v === '0');

/* sentenceLines — mirror of JSX formatSentenceFieldLines (single running counter n=1..). */
const sentenceLines = (text) => {
  const sentences = splitBySentence(text);
  const out = []; let n = 1;
  sentences.forEach((s, sIdx) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      out.push(<Text key={`l${sIdx}`} style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>);
      if (parts.length >= 2) {
        parts.forEach((item, i) => out.push(<Text key={`l${sIdx}-${i}`} style={styles.listItem}>{n++}. {safeString(item)}</Text>));
      } else {
        out.push(<Text key={`l${sIdx}-v`} style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>);
      }
    } else {
      out.push(<Text key={`s${sIdx}`} style={styles.listItem}>{n++}. {safeString(s)}</Text>);
    }
  });
  return out;
};

/* ======= PDF COMPONENT ======= */
const PotentialTestingOutcomesDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (!docProp) records = [];
  else {
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.potential_testing_outcomes) return Array.isArray(r.potential_testing_outcomes) ? r.potential_testing_outcomes : [r.potential_testing_outcomes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.potential_testing_outcomes) return Array.isArray(dd.potential_testing_outcomes) ? dd.potential_testing_outcomes : [dd.potential_testing_outcomes]; return [dd]; }
      return [r];
    });
    records = arr.filter(r => r && typeof r === 'object');
  }

  // Clean underscore-prefixed fields
  records = records.map(record => {
    if (!record || typeof record !== 'object') return record;
    const clean = {};
    for (const key of Object.keys(record)) { if (!key.startsWith('_')) clean[key] = record[key]; }
    return clean;
  });

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Potential Testing Outcomes</Text>
          <Text style={styles.noDataText}>No potential testing outcomes data available</Text>
        </Page>
      </Document>
    );
  }

  const renderField = (record, fn) => {
    const val = record[fn];
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;

    /* NUMBER — sentinel-0 hidden (ABI/GFR/A1c) */
    if (NUMBER_FIELDS.includes(fn)) {
      if (isMeaninglessZero(fn, val)) return null;
      return (
        <View key={fn} style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{safeString(fmtVal(val))}</Text>
        </View>
      );
    }

    /* ARRAY — numbered items */
    if (ARRAY_FIELDS.includes(fn) || Array.isArray(val)) {
      const items = (Array.isArray(val) ? val : [val]).filter(Boolean);
      if (items.length === 0) return null;
      return (
        <View key={fn} style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(String(item))}</Text>)}
        </View>
      );
    }

    const strVal = fmtVal(val);

    /* COMMA_SPLIT — genuine unlabeled single-sentence comma list -> numbered value rows */
    if (COMMA_SPLIT_FIELDS.includes(fn)) {
      const parts = splitByComma(strVal);
      if (parts.length >= 2 && !parseLabel(strVal).isLabeled && splitBySentence(strVal).length <= 1) {
        return (
          <View key={fn} style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>{label}</Text>
            {parts.map((p, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(p)}</Text>)}
          </View>
        );
      }
      /* else fall through to the structured / whole string logic below */
    }

    /* STRING — multi-sentence OR single labeled comma-list -> structured lines */
    const sentences = splitBySentence(strVal);
    const parsedWhole = parseLabel(strVal);
    const structured = sentences.length > 1 || (parsedWhole.isLabeled && splitByComma(parsedWhole.value).length >= 2);
    if (structured) {
      return (
        <View key={fn} style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {sentenceLines(strVal)}
        </View>
      );
    }

    /* Whole single value */
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{safeString(strVal)}</Text>
      </View>
    );
  };

  /* Anti-orphan: glue the section title to its first present field in a wrap=false View. */
  const renderSection = (record, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    const present = fields.map(f => renderField(record, f)).filter(Boolean);
    if (!present.length) return null;
    const [first, ...rest] = present;
    return (
      <View key={sid} style={styles.section}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
          {first}
        </View>
        {rest}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Potential Testing Outcomes</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>Potential Testing Outcomes {idx + 1}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PotentialTestingOutcomesDocumentPDFTemplate;
