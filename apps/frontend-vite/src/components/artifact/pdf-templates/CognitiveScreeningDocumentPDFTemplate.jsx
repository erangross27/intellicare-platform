/**
 * CognitiveScreeningDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first field's View (anti-orphan, 6a2d6af6).
 * Fields render in SECTION_FIELDS order (4-area mirror with the JSX + copy). Dates formatted; numbers
 * with a "not recorded" 0 sentinel (testDuration/educationYears) hidden; booleans Yes/No; sentence
 * fields split into numbered rows; behavioralDisturbances array numbered. Collection: cognitive_screening
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_DEFS = [
  ['Test Information', ['date', 'screeningTool', 'totalScore', 'maximumPossibleScore', 'cognitiveImpairmentSeverity', 'testDuration', 'educationYears']],
  ['Domain Scores', ['orientationScore', 'registrationScore', 'attentionCalculationScore', 'recallScore', 'languageScore', 'visuospatialScore', 'executiveFunctionScore']],
  ['Clinical Observations', ['informantPresent', 'informantConcerns', 'delirium', 'behavioralDisturbances']],
  ['Functional Status', ['functionalImpairment', 'baselineCognitiveState', 'hearingAidUsed', 'visualAidUsed', 'primaryLanguage']],
  ['Recommendations', ['referralIndicated', 'comparisonToPriorScore', 'clinicalDementiaSeverity']],
];

const FIELD_LABELS = {
  date: 'Date', screeningTool: 'Screening Tool', totalScore: 'Total Score', maximumPossibleScore: 'Maximum Score', cognitiveImpairmentSeverity: 'Impairment Severity', testDuration: 'Test Duration (min)', educationYears: 'Education (years)',
  orientationScore: 'Orientation', registrationScore: 'Registration', attentionCalculationScore: 'Attention/Calculation', recallScore: 'Recall', languageScore: 'Language', visuospatialScore: 'Visuospatial', executiveFunctionScore: 'Executive Function',
  informantPresent: 'Informant Present', informantConcerns: 'Informant Concerns', delirium: 'Delirium', behavioralDisturbances: 'Behavioral Disturbances',
  functionalImpairment: 'Functional Impairment', baselineCognitiveState: 'Baseline Cognitive State', hearingAidUsed: 'Hearing Aid Used', visualAidUsed: 'Visual Aid Used', primaryLanguage: 'Primary Language',
  referralIndicated: 'Referral Indicated', comparisonToPriorScore: 'Comparison to Prior Score', clinicalDementiaSeverity: 'Clinical Dementia Severity',
};

const ARRAY_FIELDS = ['behavioralDisturbances'];
const SENTENCE_FIELDS = ['informantConcerns', 'functionalImpairment', 'baselineCognitiveState', 'comparisonToPriorScore'];
const DATE_FIELDS = ['date'];
// A stored 0 is a "not recorded" sentinel for these two (domain subscores keep a meaningful 0).
const ZERO_SENTINEL_FIELDS = ['testDuration', 'educationYears'];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg"
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
// Comma splitter for narrative concern-lists (per sentence, >=3 gate). Paren-aware; keeps Oxford
// ", and/or X" attached; skips no-space commas ("$18,000") and date commas ("January 8, 2026").
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
// Sentence field → sentences, each comma-split into rows when it yields >=3 (Rule #73).
const sentenceCommaRows = (text) => splitBySentence(text).flatMap(s => { const p = splitByComma(s); return p.length >= 3 ? p : [s]; });

// Return the field's display rows (array of strings), or null if empty.
const fieldRows = (record, f) => {
  const val = record[f];
  if (ARRAY_FIELDS.includes(f)) {
    const arr = (Array.isArray(val) ? val : []).filter(hasVal);
    return arr.length ? arr.map(String) : null;
  }
  if (!hasVal(val)) return null;
  if (val === 0 && ZERO_SENTINEL_FIELDS.includes(f)) return null;
  if (DATE_FIELDS.includes(f)) return [formatDate(val)];
  if (SENTENCE_FIELDS.includes(f)) { const s = sentenceCommaRows(String(val)); return s.length ? s : [fmtVal(val)]; }
  return [fmtVal(val)];
};

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View. */
const renderField = ([label, rows], title, isFirst) => (
  <View key={label} style={styles.fieldUnit} wrap={rows.length + 2 > 8 ? true : false}>
    {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    <Text style={styles.fieldLabel}>{label}</Text>
    {rows.map((r, i) => <Text key={i} style={styles.listItem}>{i + 1}. {r}</Text>)}
  </View>
);

const renderSection = (record, title, fields) => {
  const present = fields.map(f => { const rows = fieldRows(record, f); return rows ? [FIELD_LABELS[f] || f, rows] : null; }).filter(Boolean);
  if (present.length === 0) return null;
  return (
    <View key={title} style={styles.section}>
      {present.map((p, fi) => renderField(p, title, fi === 0))}
    </View>
  );
};

const CognitiveScreeningDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cognitive_screening) return Array.isArray(r.cognitive_screening) ? r.cognitive_screening : [r.cognitive_screening];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cognitive_screening) return Array.isArray(dd.cognitive_screening) ? dd.cognitive_screening : [dd.cognitive_screening]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Cognitive Screening</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Cognitive Screening</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Cognitive Screening ${idx + 1}`}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => renderSection(record, title, fields))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CognitiveScreeningDocumentPDFTemplate;
