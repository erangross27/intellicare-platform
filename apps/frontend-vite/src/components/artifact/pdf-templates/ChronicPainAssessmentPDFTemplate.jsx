/**
 * ChronicPainAssessmentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); section title inside the first field's View + leaf glue (anti-orphan,
 * 6a2d6af6). Narrative fields sentence-split (guarded); every value numbered ("1." even for singles).
 * Collection: chronic_pain_assessment
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
  recordMeta: { fontSize: 12, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

const FL = {
  painLocation: 'Pain Location', painOnsetDate: 'Pain Onset Date', painDurationMonths: 'Pain Duration (months)',
  painIntensityScore: 'Pain Intensity Score', averagePainScore: 'Average Pain Score', worstPainScore: 'Worst Pain Score', painPattern: 'Pain Pattern',
  functionalImpairmentScore: 'Functional Impairment Score', activitiesOfDailyLivingImpact: 'ADL Impact', sleepDisturbance: 'Sleep Disturbance',
  painCatastrophizingScale: 'Pain Catastrophizing Scale', oswestryDisabilityIndex: 'Oswestry Disability Index',
  radiatingPain: 'Radiating Pain', neuropathicPainPresent: 'Neuropathic Pain Present', radiationPattern: 'Radiation Pattern',
  currentPainMedications: 'Current Pain Medications', opioidTherapyActive: 'Opioid Therapy Active', morphineEquivalentDose: 'Morphine Equivalent Dose (mg/day)',
};
const SENTENCE_FIELDS = new Set(['painPattern', 'activitiesOfDailyLivingImpact', 'radiationPattern']);
const DATE_FIELDS = new Set(['painOnsetDate']);
const ARRAY_FIELDS_IN_MIXED = new Set(['painLocation', 'currentPainMedications']);

const fieldRowCount = (fn, value) => {
  if (Array.isArray(value)) return safeArr(value).length + 1;
  if (SENTENCE_FIELDS.has(fn)) return splitBySentence(String(value)).length + 1;
  return 2;
};

// one field as a wrap-gated glue unit; section title rides inside when isFirst
const renderFieldUnit = (fn, value, sTitle, isFirst) => {
  const rows = fieldRowCount(fn, value) + (isFirst ? 1 : 0);
  const showLabel = (FL[fn] || fn).toLowerCase() !== String(sTitle).toLowerCase();
  let valueRows;
  if (Array.isArray(value)) valueRows = safeArr(value).map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>);
  else if (SENTENCE_FIELDS.has(fn)) valueRows = splitBySentence(String(value)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>);
  else valueRows = <Text style={styles.listItem}>1. {DATE_FIELDS.has(fn) ? formatDate(value) : fmtVal(value)}</Text>;
  return (
    <View key={fn} wrap={rows > 22 ? true : false}>
      {isFirst && <Text style={styles.sectionTitle}>{sTitle}</Text>}
      <View style={{ marginBottom: 6 }}>
        {showLabel && <Text style={styles.fieldLabel}>{FL[fn] || fn}</Text>}
        {valueRows}
      </View>
    </View>
  );
};

const renderMixedSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]) && !(ARRAY_FIELDS_IN_MIXED.has(f) && safeArr(record[f]).length === 0));
  if (visible.length === 0) return null;
  return (<View style={styles.section}>{visible.map((f, i) => renderFieldUnit(f, record[f], sTitle, i === 0))}</View>);
};

// single-array section: section title + numbered rows (no field label — single-name rule)
const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  return (
    <View style={styles.section} wrap={arr.length + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {arr.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
    </View>
  );
};

const ChronicPainAssessmentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.chronic_pain_assessment) return Array.isArray(r.chronic_pain_assessment) ? r.chronic_pain_assessment : [r.chronic_pain_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chronic_pain_assessment) return Array.isArray(dd.chronic_pain_assessment) ? dd.chronic_pain_assessment : [dd.chronic_pain_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Chronic Pain Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Chronic Pain Assessment</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Chronic Pain Assessment ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>
            {renderMixedSection('Pain Location & Onset', ['painLocation', 'painOnsetDate', 'painDurationMonths'], record)}
            {renderArraySection('Pain Quality', record.painQuality)}
            {renderMixedSection('Pain Scores', ['painIntensityScore', 'averagePainScore', 'worstPainScore', 'painPattern'], record)}
            {renderArraySection('Exacerbating Factors', record.exacerbatingFactors)}
            {renderArraySection('Alleviating Factors', record.alleviatingFactors)}
            {renderMixedSection('Radiating Pain', ['radiatingPain', 'neuropathicPainPresent', 'radiationPattern'], record)}
            {renderMixedSection('Functional Impact', ['functionalImpairmentScore', 'activitiesOfDailyLivingImpact', 'sleepDisturbance'], record)}
            {renderMixedSection('Clinical Scores', ['painCatastrophizingScale', 'oswestryDisabilityIndex'], record)}
            {renderMixedSection('Pain Medications', ['currentPainMedications', 'opioidTherapyActive', 'morphineEquivalentDose'], record)}
            {renderArraySection('Prior Interventions', record.priorInterventions)}
            {renderArraySection('Psychological Comorbidities', record.psychologicalComorbidities)}
            {renderArraySection('Red Flag Symptoms', record.redFlagSymptoms)}
            {renderArraySection('Treatment Goals', record.treatmentGoals)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ChronicPainAssessmentPDFTemplate;
