/**
 * CognitiveRehabilitationReportsDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first field's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); numeric scores with 0 = "not assessed" hidden; booleans
 * Yes/No; sentence field split into numbered rows; goals array numbered; single-name rule (rehab goals).
 * Collection: cognitive_rehabilitation_reports
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
  ['Clinical Scales', ['cognitiveAssessmentScore', 'miniMentalStateExam', 'glasgowComaScale', 'ranchosLosAmigosLevel', 'disabilityRatingScale', 'functionalIndependenceMeasure', 'galvestonOrientationTest']],
  ['Neuropsychological Testing', ['trailMakingTestA', 'trailMakingTestB', 'digitsSpanForward', 'digitsSpanBackward', 'wechslerMemoryScale', 'stroopTestScore', 'wisconsinCardSort', 'clockDrawingTest', 'bostonNamingTest']],
  ['Cognitive Profile', ['attentionDeficitSeverity', 'executiveFunctionDeficit', 'workingMemoryCapacity', 'processingSpeedIndex', 'neurocognitiveDisorderType']],
  ['Treatment', ['repetitiveTranscranialMagneticStimulation']],
  ['Rehabilitation Goals', ['cognitiveRehabilitationGoals']],
];

const FIELD_LABELS = {
  cognitiveAssessmentScore: 'Cognitive Assessment Score', miniMentalStateExam: 'Mini-Mental State Exam', glasgowComaScale: 'Glasgow Coma Scale',
  ranchosLosAmigosLevel: 'Rancho Los Amigos Level', disabilityRatingScale: 'Disability Rating Scale', functionalIndependenceMeasure: 'Functional Independence Measure',
  galvestonOrientationTest: 'Galveston Orientation Test',
  trailMakingTestA: 'Trail Making Test A', trailMakingTestB: 'Trail Making Test B', digitsSpanForward: 'Digits Span Forward', digitsSpanBackward: 'Digits Span Backward',
  wechslerMemoryScale: 'Wechsler Memory Scale', stroopTestScore: 'Stroop Test', wisconsinCardSort: 'Wisconsin Card Sort', clockDrawingTest: 'Clock Drawing Test', bostonNamingTest: 'Boston Naming Test',
  attentionDeficitSeverity: 'Attention Deficit Severity', executiveFunctionDeficit: 'Executive Function Deficit', workingMemoryCapacity: 'Working Memory Capacity',
  processingSpeedIndex: 'Processing Speed Index', neurocognitiveDisorderType: 'Neurocognitive Disorder Type',
  repetitiveTranscranialMagneticStimulation: 'Repetitive TMS',
  cognitiveRehabilitationGoals: 'Rehabilitation Goals',
};

const ARRAY_FIELDS = ['cognitiveRehabilitationGoals'];
const SENTENCE_FIELDS = ['neurocognitiveDisorderType'];
// Numeric clinical scores use 0 as a "not assessed" sentinel (e.g. GCS minimum is 3); hide those zeros.
const NUMBER_FIELDS = ['cognitiveAssessmentScore', 'miniMentalStateExam', 'glasgowComaScale', 'ranchosLosAmigosLevel', 'disabilityRatingScale', 'functionalIndependenceMeasure', 'galvestonOrientationTest', 'trailMakingTestA', 'trailMakingTestB', 'digitsSpanForward', 'digitsSpanBackward', 'wechslerMemoryScale', 'stroopTestScore', 'wisconsinCardSort', 'clockDrawingTest', 'bostonNamingTest', 'processingSpeedIndex'];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const hasFieldVal = (fn, v) => { if (NUMBER_FIELDS.includes(fn) && typeof v === 'number' && v === 0) return false; return hasVal(v); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg"
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

// Return the field's display rows (array of strings), or null if empty.
const fieldRows = (record, f) => {
  if (ARRAY_FIELDS.includes(f)) {
    const arr = (Array.isArray(record[f]) ? record[f] : []).filter(x => hasVal(x));
    return arr.length ? arr.map(String) : null;
  }
  const val = record[f];
  if (!hasFieldVal(f, val)) return null;
  if (SENTENCE_FIELDS.includes(f)) { const s = splitBySentence(String(val)); return s.length ? s : [fmtVal(val)]; }
  return [fmtVal(val)];
};

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View.
   Single-name rule: field label == section title → no sub-label (rehab goals). */
const renderField = ([label, rows], title, isFirst) => {
  const showLabel = label.toLowerCase() !== title.toLowerCase();
  return (
    <View key={label} style={styles.fieldUnit} wrap={rows.length + 2 > 8 ? true : false}>
      {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((r, i) => <Text key={i} style={styles.listItem}>{i + 1}. {r}</Text>)}
    </View>
  );
};

const renderSection = (record, title, fields) => {
  const present = fields.map(f => { const rows = fieldRows(record, f); return rows ? [FIELD_LABELS[f] || f, rows] : null; }).filter(Boolean);
  if (present.length === 0) return null;
  return (
    <View key={title} style={styles.section}>
      {present.map((p, fi) => renderField(p, title, fi === 0))}
    </View>
  );
};

const CognitiveRehabilitationReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cognitive_rehabilitation_reports) return Array.isArray(r.cognitive_rehabilitation_reports) ? r.cognitive_rehabilitation_reports : [r.cognitive_rehabilitation_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cognitive_rehabilitation_reports) return Array.isArray(dd.cognitive_rehabilitation_reports) ? dd.cognitive_rehabilitation_reports : [dd.cognitive_rehabilitation_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Cognitive Rehabilitation Reports</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Cognitive Rehabilitation Reports</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Cognitive Rehabilitation Report ${idx + 1}`}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => renderSection(record, title, fields))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CognitiveRehabilitationReportsDocumentPDFTemplate;
