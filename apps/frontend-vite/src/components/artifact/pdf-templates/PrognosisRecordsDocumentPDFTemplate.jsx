/**
 * PrognosisRecordsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — prognosis records
 * Collection: prognosis_records
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  recordMeta: { flexDirection: 'row', gap: 16, marginTop: 4 },
  metaText: { fontSize: 10, color: '#333333' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#999999', marginTop: 2 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

const chartStyles = StyleSheet.create({
  chartSection: { marginBottom: 16, padding: 12, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#dee2e6', borderRadius: 4 },
  chartTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  categoryHeader: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#444444', textTransform: 'uppercase', marginBottom: 8, marginTop: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#dee2e6' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendColor: { width: 12, height: 12, borderRadius: 2 },
  legendText: { fontSize: 9, color: '#666666' },
  barChartRow: { marginBottom: 12 },
  barLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4 },
  barContainer: { flexDirection: 'row', alignItems: 'center', height: 20, gap: 8 },
  barBackground: { flex: 1, height: 16, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', width: 45, textAlign: 'right' },
  barInterpretation: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 2 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  if (typeof val === 'object' && Object.keys(val).length === 0) return '';
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

/* ======= OBJECT-FIELD HELPERS (performanceStatusScore) ======= */
const KEY_OVERRIDES = { ecog: 'ECOG', kps: 'KPS', pps: 'PPS' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{String(label)}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{String(label)}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* ======= CHART HELPERS ======= */
const extractScoreFromText = (text) => {
  if (!text) return null;
  const match = String(text).match(/:\s*(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
};

const getGRACEInterpretation = (score) => {
  if (score <= 108) return { color: '#555555', text: 'Low Risk', max: 258 };
  if (score <= 140) return { color: '#777777', text: 'Intermediate Risk', max: 258 };
  return { color: '#222222', text: 'High Risk', max: 258 };
};

const getTIMIInterpretation = (score) => {
  if (score <= 2) return { color: '#555555', text: 'Low Risk', max: 7 };
  if (score <= 4) return { color: '#999999', text: 'Intermediate Risk', max: 7 };
  return { color: '#222222', text: 'High Risk', max: 7 };
};

const getSurvivalInterpretation = (rate) => {
  if (rate >= 80) return { color: '#555555', text: 'Excellent' };
  if (rate >= 60) return { color: '#777777', text: 'Good' };
  if (rate >= 40) return { color: '#999999', text: 'Fair' };
  return { color: '#222222', text: 'Poor' };
};

const getTreatmentResponseInterpretation = (rate) => {
  if (rate >= 80) return { color: '#555555', text: 'Very Likely' };
  if (rate >= 60) return { color: '#777777', text: 'Likely' };
  if (rate >= 40) return { color: '#999999', text: 'Possible' };
  return { color: '#222222', text: 'Unlikely' };
};

const prepareChartData = (record) => {
  const charts = [];
  if (record.fiveYearSurvivalRate && record.fiveYearSurvivalRate > 0) {
    const rate = parseFloat(record.fiveYearSurvivalRate);
    const interp = getSurvivalInterpretation(rate);
    charts.push({ key: 'survival', label: '5-Year Survival Rate', percentage: rate, rawValue: `${rate}%`, color: interp.color, interpretation: interp.text, category: 'Survival & Response' });
  }
  if (record.treatmentResponseProbability && record.treatmentResponseProbability > 0) {
    const rate = parseFloat(record.treatmentResponseProbability);
    const interp = getTreatmentResponseInterpretation(rate);
    charts.push({ key: 'treatment', label: 'Treatment Response Probability', percentage: rate, rawValue: `${rate}%`, color: interp.color, interpretation: interp.text, category: 'Survival & Response' });
  }
  if (record.prognosticIndicatorsUsed && Array.isArray(record.prognosticIndicatorsUsed)) {
    record.prognosticIndicatorsUsed.forEach(indicator => {
      const indicatorStr = safeString(indicator);
      if (indicatorStr.toLowerCase().includes('grace')) {
        const score = extractScoreFromText(indicatorStr);
        if (score !== null) {
          const interp = getGRACEInterpretation(score);
          charts.push({ key: 'grace', label: 'GRACE Score', percentage: Math.min(100, (score / interp.max) * 100), rawValue: `${score}/258`, color: interp.color, interpretation: interp.text, category: 'Risk Scores' });
        }
      }
      if (indicatorStr.toLowerCase().includes('timi')) {
        const score = extractScoreFromText(indicatorStr);
        if (score !== null) {
          const interp = getTIMIInterpretation(score);
          charts.push({ key: 'timi', label: 'TIMI Risk Score', percentage: (score / interp.max) * 100, rawValue: `${score}/7`, color: interp.color, interpretation: interp.text, category: 'Risk Scores' });
        }
      }
    });
  }
  return charts;
};

/* ======= PDF COMPONENTS ======= */
const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#555555' }]} /><Text style={chartStyles.legendText}>Excellent/Low</Text></View>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#777777' }]} /><Text style={chartStyles.legendText}>Good/Intermediate</Text></View>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#999999' }]} /><Text style={chartStyles.legendText}>Fair/Moderate</Text></View>
    <View style={chartStyles.legendItem}><View style={[chartStyles.legendColor, { backgroundColor: '#222222' }]} /><Text style={chartStyles.legendText}>Poor/High Risk</Text></View>
  </View>
);

const PDFBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={chartStyles.barChartRow}>
    <Text style={chartStyles.barLabel}>{String(label)}</Text>
    <View style={chartStyles.barContainer}>
      <View style={chartStyles.barBackground}><View style={[chartStyles.barFill, { width: `${percentage}%`, backgroundColor: color }]} /></View>
      <Text style={chartStyles.barValue}>{String(rawValue)}</Text>
    </View>
    <Text style={[chartStyles.barInterpretation, { color }]}>{String(interpretation)}</Text>
  </View>
);

const Field = ({ label, value }) => {
  if (!hasVal(value)) return null;
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeString(value);
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{String(label)}</Text>
      <Text style={styles.fieldValue}>{displayValue}</Text>
    </View>
  );
};

/* ======= MAIN TEMPLATE ======= */
const PrognosisRecordsDocumentPDFTemplate = ({ document: data }) => {
  if (!data) return null;

  let recordsArray = [];
  if (Array.isArray(data)) {
    recordsArray = data;
  } else if (data.prognosis_records && Array.isArray(data.prognosis_records)) {
    recordsArray = data.prognosis_records;
  } else if (data.documentData && data.documentData.records) {
    recordsArray = Array.isArray(data.documentData.records) ? data.documentData.records : [data.documentData.records];
  } else {
    recordsArray = [data];
  }

  if (recordsArray.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Prognosis Records</Text></View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {recordsArray.map((record, idx) => {
        const chartData = prepareChartData(record);
        const hasChartData = chartData.length > 0;
        const survivalCharts = chartData.filter(c => c.category === 'Survival & Response');
        const riskCharts = chartData.filter(c => c.category === 'Risk Scores');

        return (
          <Page key={idx} size="LETTER" style={styles.page} wrap>
            <View style={styles.documentHeader}><Text style={styles.documentTitle}>Prognosis Records</Text></View>

            {/* Record Header */}
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>{record.currentDiseaseStage ? String(record.currentDiseaseStage) : `Prognosis Record ${idx + 1}`}</Text>
              <View style={styles.recordMeta}>
                <Text style={styles.metaText}>Date: {formatDate(record.date)}</Text>
                {record.provider && <Text style={styles.metaText}>Provider: {String(record.provider)}</Text>}
                {record.facility && <Text style={styles.metaText}>Facility: {String(record.facility)}</Text>}
              </View>
            </View>

            {/* Score Overview */}
            {hasChartData && (
              <View style={chartStyles.chartSection} wrap={false}>
                <Text style={chartStyles.chartTitle} wrap={false}>Score Overview</Text>
                <PDFLegend />
                {survivalCharts.length > 0 && (
                  <>
                    <Text style={chartStyles.categoryHeader}>Survival &amp; Response</Text>
                    {survivalCharts.map(chart => <PDFBarChart key={chart.key} label={chart.label} percentage={chart.percentage} rawValue={chart.rawValue} color={chart.color} interpretation={chart.interpretation} />)}
                  </>
                )}
                {riskCharts.length > 0 && (
                  <>
                    <Text style={chartStyles.categoryHeader}>Risk Scores</Text>
                    {riskCharts.map(chart => <PDFBarChart key={chart.key} label={chart.label} percentage={chart.percentage} rawValue={chart.rawValue} color={chart.color} interpretation={chart.interpretation} />)}
                  </>
                )}
              </View>
            )}

            {/* Disease Stage */}
            {(hasVal(record.currentDiseaseStage) || hasVal(record.diseaseStagingClassification) || hasVal(record.diagnosisCode)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={80}>Disease Stage</Text>
                <Field label="Current Disease Stage" value={record.currentDiseaseStage} />
                <Field label="Disease Staging Classification" value={record.diseaseStagingClassification} />
                <Field label="Diagnosis Code" value={record.diagnosisCode} />
              </View>
            )}

            {/* Clinical Course */}
            {(hasVal(record.expectedClinicalCourse) || hasVal(record.survivalEstimateMonths) || hasVal(record.fiveYearSurvivalRate) || hasVal(record.treatmentResponseProbability)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={80}>Clinical Course</Text>
                <Field label="Expected Clinical Course" value={record.expectedClinicalCourse} />
                {hasVal(record.survivalEstimateMonths) && <Field label="Survival Estimate (Months)" value={record.survivalEstimateMonths} />}
                {hasVal(record.fiveYearSurvivalRate) && <Field label="5-Year Survival Rate" value={`${record.fiveYearSurvivalRate}%`} />}
                {hasVal(record.treatmentResponseProbability) && <Field label="Treatment Response Probability" value={`${record.treatmentResponseProbability}%`} />}
              </View>
            )}

            {/* Prognosis Overview */}
            {(hasVal(record.functionalRecoveryLikelihood) || hasVal(record.qualityOfLifeProjection) || hasVal(record.confidenceLevel) || hasVal(record.recurrenceRiskPercentage) || hasVal(record.timeToProgressionEstimate)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={80}>Prognosis Overview</Text>
                <Field label="Functional Recovery Likelihood" value={record.functionalRecoveryLikelihood} />
                <Field label="Quality of Life Projection" value={record.qualityOfLifeProjection} />
                <Field label="Confidence Level" value={record.confidenceLevel} />
                {hasVal(record.recurrenceRiskPercentage) && <Field label="Recurrence Risk Percentage" value={`${record.recurrenceRiskPercentage}%`} />}
                <Field label="Time to Progression Estimate" value={record.timeToProgressionEstimate} />
              </View>
            )}

            {/* Prognostic Indicators */}
            {((record.prognosticIndicatorsUsed && record.prognosticIndicatorsUsed.length > 0) || hasVal(record.performanceStatusScore) || hasVal(record.comorbidityImpactScore)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={80}>Prognostic Indicators</Text>
                {record.prognosticIndicatorsUsed && record.prognosticIndicatorsUsed.length > 0 && record.prognosticIndicatorsUsed.map((item, i) => (
                  <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                ))}
                {hasVal(record.performanceStatusScore) && (
                  isScalar(record.performanceStatusScore) ? (
                    <Field label="Performance Status Score" value={record.performanceStatusScore} />
                  ) : (
                    <View style={styles.fieldBox} wrap={countRows(record.performanceStatusScore) > 8 ? undefined : false}>
                      <Text style={styles.fieldLabel}>Performance Status Score</Text>
                      {Object.entries(record.performanceStatusScore).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `performanceStatusScore-${k}`, 1))}
                    </View>
                  )
                )}
                {hasVal(record.comorbidityImpactScore) && <Field label="Comorbidity Impact Score" value={record.comorbidityImpactScore} />}
              </View>
            )}

            {/* Biomarkers & Risks */}
            {((record.biomarkerValues && record.biomarkerValues.length > 0) || (record.predictedComplicationRisks && record.predictedComplicationRisks.length > 0) || hasVal(record.comparativeReferenceData)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={80}>Biomarkers &amp; Risks</Text>
                {record.biomarkerValues && record.biomarkerValues.length > 0 && (
                  <>
                    <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>Biomarker Values</Text>
                    {record.biomarkerValues.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>)}
                  </>
                )}
                {record.predictedComplicationRisks && record.predictedComplicationRisks.length > 0 && (
                  <>
                    <Text style={[styles.fieldLabel, { marginTop: 8, marginBottom: 4 }]}>Predicted Complication Risks</Text>
                    {record.predictedComplicationRisks.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>)}
                  </>
                )}
                <Field label="Comparative Reference Data" value={record.comparativeReferenceData} />
              </View>
            )}

            {/* Modifiable Factors */}
            {((record.modifiableRiskFactors && record.modifiableRiskFactors.length > 0) || (record.anticipatedMilestones && record.anticipatedMilestones.length > 0) || (record.palliativeCareIndicators && record.palliativeCareIndicators.length > 0)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={80}>Modifiable Factors</Text>
                {record.modifiableRiskFactors && record.modifiableRiskFactors.length > 0 && (
                  <>
                    <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>Modifiable Risk Factors</Text>
                    {record.modifiableRiskFactors.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>)}
                  </>
                )}
                {record.anticipatedMilestones && record.anticipatedMilestones.length > 0 && (
                  <>
                    <Text style={[styles.fieldLabel, { marginTop: 8, marginBottom: 4 }]}>Anticipated Milestones</Text>
                    {record.anticipatedMilestones.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>)}
                  </>
                )}
                {record.palliativeCareIndicators && record.palliativeCareIndicators.length > 0 && (
                  <>
                    <Text style={[styles.fieldLabel, { marginTop: 8, marginBottom: 4 }]}>Palliative Care Indicators</Text>
                    {record.palliativeCareIndicators.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>)}
                  </>
                )}
              </View>
            )}
          </Page>
        );
      })}
    </Document>
  );
};

export default PrognosisRecordsDocumentPDFTemplate;
