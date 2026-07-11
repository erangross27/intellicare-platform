/**
 * FallsPreventionProgramAssessmentDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 size — BLACK & WHITE ONLY (#000000, no blue)
 * Data collection: falls_prevention_program_assessment
 *
 * Rule #74 — each field/section = ONE <View> with conditional wrap;
 * sectionTitle rendered INSIDE the field box (passed to first present field),
 * never a standalone sibling; only recordHeader has unconditional wrap={false};
 * no borderBottom on sectionTitle; box-free.
 *
 * Field handling mirrors the JSX:
 *   - SIMPLE STRINGS → plain value
 *   - NARRATIVE STRINGS → numbered sentences when multi-sentence
 *   - ARRAYS OF STRINGS → numbered list items
 *   - ARRAY OF OBJECTS (fallsHistory) → each item a small block (date as sub-label + other fields as value lines)
 *   - DATE → formatted date (1970-epoch/null hidden); also a header date badge
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  itemBlock: { marginBottom: 6 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'falls-history': 'Falls History',
  'mobility-balance': 'Mobility & Balance Tests',
  'risk-interventions': 'Risk & Interventions',
  'program': 'Program',
};

const FIELD_LABELS = {
  fallsHistory: 'Falls History',
  tugTest: 'TUG Test',
  bergBalance: 'Berg Balance',
  chairStand: 'Chair Stand',
  gaitSpeed: 'Gait Speed',
  gaitPattern: 'Gait Pattern',
  fallRiskFactors: 'Fall Risk Factors',
  interventions: 'Interventions',
  recommendations: 'Recommendations',
  assessmentDate: 'Assessment Date',
  programType: 'Program Type',
  findings: 'Findings',
  goals: 'Goals',
  progress: 'Progress',
  followUp: 'Follow-up',
};

const SECTION_FIELDS = {
  'falls-history': ['fallsHistory'],
  'mobility-balance': ['tugTest', 'bergBalance', 'chairStand', 'gaitSpeed', 'gaitPattern'],
  'risk-interventions': ['fallRiskFactors', 'interventions', 'recommendations'],
  'program': ['assessmentDate', 'programType', 'findings', 'goals', 'progress', 'followUp'],
};

const NARRATIVE_STRING_FIELDS = ['recommendations', 'findings', 'goals', 'progress', 'followUp'];
const ARRAY_FIELDS = ['fallRiskFactors', 'interventions'];
const OBJECT_ARRAY_FIELDS = ['fallsHistory'];
const DATE_FIELDS = ['assessmentDate'];

const FALLS_HISTORY_KEY_ORDER = ['date', 'location', 'injury', 'circumstances'];
const FALLS_HISTORY_LABELS = { date: 'Date', location: 'Location', injury: 'Injury', circumstances: 'Circumstances' };

/* ======= UTILS ======= */
const isLeafEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const hasArray = (v) => Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;

const hasObjectArray = (v) => Array.isArray(v) && v.some(item => item && typeof item === 'object' && Object.values(item).some(x => !isLeafEmpty(x)));

const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '';
};

const parseDate = (dateValue) => {
  if (dateValue === null || dateValue === undefined || dateValue === '') return '';
  try {
    const raw = (typeof dateValue === 'object' && dateValue.$date) ? dateValue.$date : dateValue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    if (d.getTime() === 0 || d.getUTCFullYear() <= 1970) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
};

const hasDate = (v) => parseDate(v) !== '';

const fieldHasVal = (fn, v) => {
  if (OBJECT_ARRAY_FIELDS.includes(fn)) return hasObjectArray(v);
  if (ARRAY_FIELDS.includes(fn)) return hasArray(v);
  if (DATE_FIELDS.includes(fn)) return hasDate(v);
  return hasString(v);
};

const fieldVisible = (record, fn) => fieldHasVal(fn, record[fn]);

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* ======= SENTENCE SPLIT ======= */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/)
    .map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* ======= RENDER FIELD ======= */
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!fieldVisible(record, fn)) return null;
  const label = FIELD_LABELS[fn] || fn;

  let body;
  if (OBJECT_ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : []).filter(item => item && typeof item === 'object' && Object.values(item).some(x => !isLeafEmpty(x)));
    body = items.map((item, i) => {
      const orderedKeys = [
        ...FALLS_HISTORY_KEY_ORDER.filter(k => !isLeafEmpty(item[k])),
        ...Object.keys(item).filter(k => !FALLS_HISTORY_KEY_ORDER.includes(k) && !isLeafEmpty(item[k])),
      ];
      if (orderedKeys.length === 0) return null;
      const headKey = orderedKeys[0];
      const restKeys = orderedKeys.slice(1);
      /* STACKED sub-label / value pairs (never side-by-side "key: value") */
      return (
        <View key={i} style={styles.itemBlock}>
          {[headKey, ...restKeys].map(k => (
            <View key={k}>
              <Text style={styles.subLabel}>{FALLS_HISTORY_LABELS[k] || k}</Text>
              <Text style={styles.fieldValue}>{safeString(item[k])}</Text>
            </View>
          ))}
        </View>
      );
    });
  } else if (DATE_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>{parseDate(val)}</Text>;
  } else if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    body = items.map((item, i) => {
      const p = parseLabel(String(item));
      return <Text key={i} style={styles.listItem}>{i + 1}. {p.value || String(item)}</Text>;
    });
  } else {
    const strVal = safeString(val);
    const sentences = splitBySentence(strVal);
    if (NARRATIVE_STRING_FIELDS.includes(fn) && sentences.length > 1) {
      body = sentences.map((s, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/[;.]+$/, '').trim()}</Text>
      ));
    } else {
      body = <Text style={styles.fieldValue}>{strVal}</Text>;
    }
  }

  return (
    <View key={fn} style={{ marginBottom: 6 }}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {body}
    </View>
  );
};

/* ======= RENDER SECTION — title INSIDE first present field + conditional wrap ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => fieldVisible(record, f));
  if (presentFields.length === 0) return null;

  return (
    <View key={sid} style={styles.fieldBox} wrap={presentFields.length > 8}>
      {presentFields.map((f, i) => renderField(record, f, i === 0 ? title : null))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const FallsPreventionProgramAssessmentDocumentPDFTemplate = ({ document: docProp }) => {
  const pick = (r) => r && r.falls_prevention_program_assessment;
  let records = [];
  if (Array.isArray(docProp)) {
    const p0 = docProp.length > 0 ? pick(docProp[0]) : null;
    if (p0 && Array.isArray(p0)) {
      records = p0;
    } else {
      records = docProp;
    }
  } else if (docProp && pick(docProp)) {
    const p = pick(docProp);
    records = Array.isArray(p) ? p : [p];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Falls Prevention Program Assessment</Text>
          <Text style={styles.noDataText}>No falls prevention program assessment data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Falls Prevention Program Assessment</Text>
        {records.map((record, idx) => {
          const title = `Falls Prevention Program Assessment ${idx + 1}`;
          /* assessmentDate renders in the Program section — no header date badge (mirror JSX) */
          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>{title}</Text>
              {renderSection(record, 'falls-history')}
              {renderSection(record, 'mobility-balance')}
              {renderSection(record, 'risk-interventions')}
              {renderSection(record, 'program')}
            </View>
          );
        })}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default FallsPreventionProgramAssessmentDocumentPDFTemplate;
