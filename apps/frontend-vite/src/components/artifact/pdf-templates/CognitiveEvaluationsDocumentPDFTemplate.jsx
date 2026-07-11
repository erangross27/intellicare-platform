/**
 * CognitiveEvaluationsDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first field's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); score fields with 0 = "not administered" are hidden;
 * memoryDomainImpairment array = label + numbered items. Mirrors Copy Section/Copy All.
 * Collection: cognitive_evaluations
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
  ['Screening Scores', ['mmseScore', 'mocaScore', 'glasgowComaScale', 'clockDrawingTest']],
  ['Neuropsychological Tests', ['trailMakingTestA', 'trailMakingTestB', 'verbalFluencyScore', 'digitSpanForward', 'digitSpanBackward', 'bostonNamingTest', 'wisconsinCardSortTest', 'stroopTestScore', 'reyComplexFigure', 'californiVerbalLearning']],
  ['Cognitive Indices', ['iqScore', 'processingSpeedIndex', 'workingMemoryIndex', 'perceptualReasoningIndex', 'verbalComprehensionIndex']],
  ['Functional Assessment', ['attentionDeficitRating', 'executiveFunctionScore', 'cognitiveReserveIndex']],
  ['Memory Domains', ['memoryDomainImpairment']],
];

const FIELD_LABELS = {
  mmseScore: 'MMSE Score', mocaScore: 'MoCA Score', glasgowComaScale: 'Glasgow Coma Scale', clockDrawingTest: 'Clock Drawing Test',
  trailMakingTestA: 'Trail Making Test A', trailMakingTestB: 'Trail Making Test B', verbalFluencyScore: 'Verbal Fluency', digitSpanForward: 'Digit Span Forward', digitSpanBackward: 'Digit Span Backward', bostonNamingTest: 'Boston Naming Test', wisconsinCardSortTest: 'Wisconsin Card Sort', stroopTestScore: 'Stroop Test', reyComplexFigure: 'Rey Complex Figure', californiVerbalLearning: 'California Verbal Learning',
  iqScore: 'IQ Score', processingSpeedIndex: 'Processing Speed Index', workingMemoryIndex: 'Working Memory Index', perceptualReasoningIndex: 'Perceptual Reasoning Index', verbalComprehensionIndex: 'Verbal Comprehension Index',
  attentionDeficitRating: 'Attention Deficit Rating', executiveFunctionScore: 'Executive Function', cognitiveReserveIndex: 'Cognitive Reserve Index',
  memoryDomainImpairment: 'Memory Domain Impairment',
};

const ARRAY_FIELDS = ['memoryDomainImpairment'];
// Score fields use 0 as a "not administered" sentinel (real data: complementary MMSE/MoCA) — hide it
const NUMERIC_FIELDS = [
  'mmseScore', 'mocaScore', 'glasgowComaScale', 'clockDrawingTest',
  'trailMakingTestA', 'trailMakingTestB', 'verbalFluencyScore', 'digitSpanForward', 'digitSpanBackward', 'bostonNamingTest', 'wisconsinCardSortTest', 'stroopTestScore', 'reyComplexFigure', 'californiVerbalLearning',
  'iqScore', 'processingSpeedIndex', 'workingMemoryIndex', 'perceptualReasoningIndex', 'verbalComprehensionIndex',
  'attentionDeficitRating', 'executiveFunctionScore', 'cognitiveReserveIndex',
];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v, fn) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return !(fn && NUMERIC_FIELDS.includes(fn) && v === 0); if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

// Return the field's display rows (array of strings), or null if empty.
const fieldRows = (record, f) => {
  if (ARRAY_FIELDS.includes(f)) {
    const arr = (Array.isArray(record[f]) ? record[f] : []).filter(x => hasVal(x));
    return arr.length ? arr.map(String) : null;
  }
  const val = record[f];
  if (!hasVal(val, f)) return null;
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

const CognitiveEvaluationsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cognitive_evaluations) return Array.isArray(r.cognitive_evaluations) ? r.cognitive_evaluations : [r.cognitive_evaluations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cognitive_evaluations) return Array.isArray(dd.cognitive_evaluations) ? dd.cognitive_evaluations : [dd.cognitive_evaluations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Cognitive Evaluations</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Cognitive Evaluations</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Cognitive Evaluation ${idx + 1}`}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => renderSection(record, title, fields))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CognitiveEvaluationsDocumentPDFTemplate;
