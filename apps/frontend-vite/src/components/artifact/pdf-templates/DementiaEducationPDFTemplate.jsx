/**
 * DementiaEducationPDFTemplate.jsx (renamed from DementiaEducationPDFTemplate)
 * March 2026 — Helvetica — LETTER size — no boxes
 * Collection: dementia_education
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { marginBottom: 0, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { paddingBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 2 },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 2, paddingLeft: 12 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#999999' },
  /* Bar chart styles (B&W greyscale chart) */
  chartContainer: { marginBottom: 10 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8 },
  legendText: { fontSize: 10, color: '#000000' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  barLabel: { width: 120, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'right' },
  barBackground: { flex: 1, height: 14, backgroundColor: '#eeeeee' },
  barFill: { height: '100%', minWidth: 4 },
  barValue: { width: 40, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  barInterpretation: { width: 62, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArray = (val) => Array.isArray(val) ? val.filter(Boolean) : [];

const OVERVIEW_FIELDS = [
  { key: 'dementiaType', label: 'Dementia Type' },
  { key: 'diseaseStage', label: 'Disease Stage' },
  { key: 'caregiverType', label: 'Caregiver Type' },
  { key: 'fallRiskAssessment', label: 'Fall Risk Assessment' },
  { key: 'advanceDirectiveStatus', label: 'Advance Directive Status' },
  { key: 'wanderingBehavior', label: 'Wandering Behavior' },
  { key: 'respiteCareNeeds', label: 'Respite Care Needs' },
  { key: 'nutritionalStatus', label: 'Nutritional Status' },
];

const SCORE_CONFIG = [
  { key: 'mmseScore', label: 'MMSE Score', max: 30 },
  { key: 'mocsScore', label: 'MoCA Score', max: 30 },
  { key: 'cdrGlobalScore', label: 'CDR Global Score', max: 3 },
  { key: 'npiScore', label: 'NPI Score', max: 144 },
  { key: 'adlScore', label: 'ADL Score', max: 6 },
  { key: 'iadlScore', label: 'IADL Score', max: 8 },
  { key: 'caregiverBurdenScore', label: 'Caregiver Burden Score', max: 88 },
];

const ARRAY_SECTIONS = [
  { key: 'educationTopics', title: 'Education Topics' },
  { key: 'behavioralSymptoms', title: 'Behavioral Symptoms' },
  { key: 'agitationTriggers', title: 'Agitation Triggers' },
  { key: 'communicationStrategies', title: 'Communication Strategies' },
  { key: 'environmentalModifications', title: 'Environmental Modifications' },
  { key: 'sleepDisorders', title: 'Sleep Disorders' },
  { key: 'nonPharmacologicalInterventions', title: 'Non-Pharmacological Interventions' },
  { key: 'cognitiveEnhancerMedications', title: 'Cognitive Enhancer Medications' },
];

const getScoreInterpretation = (key, value) => {
  switch (key) {
    case 'mmseScore': return value >= 24 ? { color: '#6f6f6f', text: 'Normal' } : value >= 18 ? { color: '#878787', text: 'Mild' } : { color: '#5c5c5c', text: 'Severe' };
    case 'mocsScore': return value >= 26 ? { color: '#6f6f6f', text: 'Normal' } : value >= 18 ? { color: '#878787', text: 'Mild' } : { color: '#5c5c5c', text: 'Severe' };
    case 'cdrGlobalScore': return value <= 0 ? { color: '#6f6f6f', text: 'Normal' } : value <= 1 ? { color: '#878787', text: 'Mild' } : { color: '#5c5c5c', text: 'Severe' };
    case 'npiScore': return value <= 12 ? { color: '#6f6f6f', text: 'Minimal' } : value <= 36 ? { color: '#878787', text: 'Moderate' } : { color: '#5c5c5c', text: 'Severe' };
    case 'adlScore': return value >= 5 ? { color: '#6f6f6f', text: 'Independent' } : value >= 3 ? { color: '#878787', text: 'Some Help' } : { color: '#5c5c5c', text: 'Dependent' };
    case 'iadlScore': return value >= 6 ? { color: '#6f6f6f', text: 'Independent' } : value >= 4 ? { color: '#878787', text: 'Some Help' } : { color: '#5c5c5c', text: 'Dependent' };
    case 'caregiverBurdenScore': return value <= 20 ? { color: '#6f6f6f', text: 'Minimal' } : value <= 40 ? { color: '#878787', text: 'Mild' } : { color: '#5c5c5c', text: 'Severe' };
    default: return { color: '#555555', text: '' };
  }
};

/* ═══ COMPONENT ═══ */
const DementiaEducationDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dementia_education) return Array.isArray(r.dementia_education) ? r.dementia_education : [r.dementia_education];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dementia_education) return Array.isArray(dd.dementia_education) ? dd.dementia_education : [dd.dementia_education]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dementia Education</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dementia Education</Text></View>

        {records.map((record, idx) => {
          /* Prepare overview fields */
          const visibleOverview = OVERVIEW_FIELDS.filter(f => hasVal(record[f.key]));

          /* Prepare scores */
          const visibleScores = SCORE_CONFIG.filter(s => hasVal(record[s.key]));

          /* Build legend */
          const legendColors = new Map();
          visibleScores.forEach(s => {
            const interp = getScoreInterpretation(s.key, Number(record[s.key]));
            if (!legendColors.has(interp.color)) legendColors.set(interp.color, interp.text);
          });

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Dementia Education ${idx + 1}`}</Text>
              </View>

              {/* Section 1: Clinical Overview */}
              {visibleOverview.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={visibleOverview.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Clinical Overview</Text>
                    {visibleOverview.map((f, i) => (
                      <View key={i} style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>{f.label}</Text>
                        <Text style={styles.listItem}>1. {safeString(fmtVal(record[f.key]))}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 2: Assessment Scores (Bar Chart) */}
              {visibleScores.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.chartContainer} wrap={false}>
                    <Text style={styles.sectionTitle}>Assessment Scores</Text>
                    <View style={styles.legendRow}>
                      {[...legendColors.entries()].map(([color, text], i) => (
                        <View key={i} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: color }]} />
                          <Text style={styles.legendText}>{text}</Text>
                        </View>
                      ))}
                    </View>
                    {visibleScores.map(s => {
                      const val = Number(record[s.key]);
                      const pct = Math.min(100, Math.max(2, (val / s.max) * 100));
                      const interp = getScoreInterpretation(s.key, val);
                      return (
                        <View key={s.key} style={styles.barRow}>
                          <Text style={styles.barLabel}>{s.label}</Text>
                          <View style={styles.barBackground}>
                            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: interp.color }]} />
                          </View>
                          <Text style={[styles.barValue, { color: interp.color }]}>{val}/{s.max}</Text>
                          <Text style={[styles.barInterpretation, { color: interp.color }]}>{interp.text}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Sections 3-10: Array Sections */}
              {ARRAY_SECTIONS.map(({ key, title }) => {
                const items = safeArray(record[key]);
                if (items.length === 0) return null;
                return (
                  <View key={key} style={styles.section}>
                    <View style={styles.fieldBox} wrap={items.length > 8 ? true : false}>
                      <Text style={styles.sectionTitle}>{title}</Text>
                      {items.map((item, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

      </Page>
    </Document>
  );
};

export default DementiaEducationDocumentPDFTemplate;
