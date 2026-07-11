/**
 * ClinicalRiskScoresDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first field's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); single-name rule (field label == section title → hidden).
 * Meaningful-zero: score fields where 0 is a valid clinical result stay visible; other numeric 0s hidden.
 * Collection: clinical_risk_scores
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
  ['Score Overview', ['scoreType', 'totalScore', 'riskCategory', 'scoringIndication']],
  ['Provider Information', ['provider', 'facility']],
  ['Patient Assessment', ['ageAtAssessment', 'glasgowComaScore', 'assessmentTimepoint', 'clinicalSetting', 'calculationMethod']],
  ['Predictions & Validation', ['predictedMortality', 'predictedMorbidity', 'bleedingRiskScore', 'comparativePreviousScore', 'scoreValidation', 'anticoagulationIndicated']],
  ['Comorbidity Factors', ['comorbidityFactors']],
  ['Component Scores', ['componentScores']],
  ['Vital Signs Used', ['vitalSignsUsed']],
  ['Laboratory Values Used', ['laboratoryValuesUsed']],
  ['Score Interpretation', ['scoreInterpretation']],
  ['Therapeutic Recommendations', ['therapeuticRecommendations']],
  ['Risk Mitigation Plan', ['riskMitigationPlan']],
  ['Organ Failure Assessment', ['organFailureAssessment']],
];
const FIELD_LABELS = {
  scoreType: 'Score Type', totalScore: 'Total Score', riskCategory: 'Risk Category', scoringIndication: 'Scoring Indication',
  provider: 'Provider', facility: 'Facility',
  ageAtAssessment: 'Age at Assessment', glasgowComaScore: 'Glasgow Coma Score', assessmentTimepoint: 'Assessment Timepoint', clinicalSetting: 'Clinical Setting', calculationMethod: 'Calculation Method',
  predictedMortality: 'Predicted Mortality', predictedMorbidity: 'Predicted Morbidity', bleedingRiskScore: 'Bleeding Risk Score', comparativePreviousScore: 'Comparative Previous Score', scoreValidation: 'Score Validation', anticoagulationIndicated: 'Anticoagulation Indicated',
  comorbidityFactors: 'Comorbidity Factors', componentScores: 'Component Scores', vitalSignsUsed: 'Vital Signs Used', laboratoryValuesUsed: 'Laboratory Values Used',
  scoreInterpretation: 'Score Interpretation', therapeuticRecommendations: 'Therapeutic Recommendations', riskMitigationPlan: 'Risk Mitigation Plan', organFailureAssessment: 'Organ Failure Assessment',
};
const ARRAY_FIELDS = ['comorbidityFactors', 'componentScores', 'vitalSignsUsed', 'laboratoryValuesUsed', 'therapeuticRecommendations', 'organFailureAssessment'];
const SENTENCE_FIELDS = ['scoreInterpretation', 'riskMitigationPlan', 'scoringIndication'];
const NUMBER_FIELDS = ['totalScore', 'glasgowComaScore', 'ageAtAssessment', 'predictedMortality', 'predictedMorbidity', 'bleedingRiskScore', 'comparativePreviousScore'];
/* meaningful-zero: risk-score values where 0 is a valid clinical result (e.g. CHA₂DS₂-VASc 0 = low risk) */
const MEANINGFUL_ZERO_FIELDS = ['totalScore', 'predictedMortality', 'predictedMorbidity', 'bleedingRiskScore', 'comparativePreviousScore'];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const numShows = (f, v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); if (Number.isNaN(n)) return false; if (n === 0) return MEANINGFUL_ZERO_FIELDS.includes(f); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

// field → {label|null, rows[]}; null when hidden. Single-name rule: label == section title → no label.
const fieldEntry = (record, f, title) => {
  const v = record[f];
  if (NUMBER_FIELDS.includes(f)) { if (!numShows(f, v)) return null; }
  else if (!hasVal(v)) return null;
  let rows;
  if (Array.isArray(v)) rows = v.filter(Boolean).map(fmtVal);
  else if (SENTENCE_FIELDS.includes(f)) rows = splitBySentence(String(v));
  else rows = [fmtVal(v)];
  if (rows.length === 0) return null;
  const label = FIELD_LABELS[f] || f;
  return { label: label.toLowerCase() === title.toLowerCase() ? null : label, rows };
};

// section = flowing container of per-field glue units; sectionTitle rides inside the FIRST field's View.
const renderSection = (title, fields, record) => {
  const entries = fields.map(f => fieldEntry(record, f, title)).filter(Boolean);
  if (entries.length === 0) return null;
  return (
    <View style={styles.section}>
      {entries.map((e, i) => (
        <View key={i} style={styles.fieldUnit} wrap={e.rows.length + 2 > 8 ? true : false}>
          {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {e.label && <Text style={styles.fieldLabel}>{e.label}</Text>}
          {e.rows.map((r, j) => <Text key={j} style={styles.listItem}>{j + 1}. {r}</Text>)}
        </View>
      ))}
    </View>
  );
};

const ClinicalRiskScoresDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.clinical_risk_scores) return Array.isArray(r.clinical_risk_scores) ? r.clinical_risk_scores : [r.clinical_risk_scores];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.clinical_risk_scores) return Array.isArray(dd.clinical_risk_scores) ? dd.clinical_risk_scores : [dd.clinical_risk_scores]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Clinical Risk Scores</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Clinical Risk Scores</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Clinical Risk Scores ${idx + 1}`}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => <React.Fragment key={title}>{renderSection(title, fields, record)}</React.Fragment>)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ClinicalRiskScoresDocumentPDFTemplate;
