import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PulmonaryFunctionTestsDocumentPDFTemplate - March 2026 Standards
 *
 * Features:
 * - Helvetica font (NOT Courier)
 * - LETTER page size
 * - Large fonts (20pt title, 12pt content)
 * - Bar chart visualization for PFT scores
 * - Keep-With-Next pattern (wrap={false})
 * - String() wrapping for all dynamic values
 */

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
  },
  documentHeader: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordHeader: {
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 12,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    width: 140,
  },
  value: {
    fontSize: 12,
    flex: 1,
  },
  line: {
    fontSize: 12,
    marginBottom: 4,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 12,
  },
  divider: {
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
  chartSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 8,
    color: '#495057',
  },
  barChartRow: {
    marginBottom: 10,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginLeft: 8,
    width: 50,
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 9,
    marginTop: 2,
    paddingLeft: 4,
  },
});

/* ═══════ HELPERS ═══════ */
const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'object' && !Array.isArray(val)) {
    const keys = Object.keys(val);
    if (keys.length === 0) return false;
    return Object.values(val).some(v => {
      if (v === null || v === undefined || v === '') return false;
      if (typeof v === 'object' && !Array.isArray(v)) return hasValue(v);
      if (Array.isArray(v)) return v.length > 0;
      return true;
    });
  }
  if (Array.isArray(val)) return val.length > 0;
  return true;
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.value !== undefined && val.value !== null) return String(val.value);
    if (val.percentPredicted !== undefined && val.percentPredicted !== null) return String(val.percentPredicted);
    return '';
  }
  return String(val);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateString); }
};

const extractPftPercentage = (val) => {
  if (!val) return null;
  const str = safeString(val);
  if (!str) return null;
  const percentMatch = str.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) return parseFloat(percentMatch[1]);
  const numMatch = str.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) return parseFloat(numMatch[1]);
  return null;
};

/* Grayscale-only (B&W PDF): darker shade = better result, lighter = worse */
const getPftColor = (pct) => { if (pct >= 80) return '#333333'; if (pct >= 60) return '#595959'; if (pct >= 40) return '#808080'; return '#A6A6A6'; };
const getPftInterpretation = (pct) => { if (pct >= 80) return 'Normal'; if (pct >= 60) return 'Mildly Reduced'; if (pct >= 40) return 'Moderately Reduced'; return 'Severely Reduced'; };
const getRatioColor = (pct) => { if (pct >= 80) return '#333333'; if (pct >= 70) return '#595959'; if (pct >= 60) return '#808080'; return '#A6A6A6'; };
const getRatioInterpretation = (pct) => { if (pct >= 80) return 'Normal'; if (pct >= 70) return 'Low Normal'; if (pct >= 60) return 'Mild Obstruction'; return 'Significant Obstruction'; };

const prepareChartData = (test) => {
  const charts = [];
  const pre = test.preBronchodilator || {};
  const fev1Pct = extractPftPercentage(pre.fev1?.percentPredicted || pre.fev1?.value || test.fev1?.percentPredicted || test.fev1?.value);
  if (fev1Pct !== null && fev1Pct > 0) charts.push({ label: 'FEV1 (% Predicted)', percentage: Math.min(100, fev1Pct), rawValue: `${fev1Pct}%`, color: getPftColor(fev1Pct), interpretation: getPftInterpretation(fev1Pct) });
  const fvcPct = extractPftPercentage(pre.fvc?.percentPredicted || pre.fvc?.value || test.fvc?.percentPredicted || test.fvc?.value);
  if (fvcPct !== null && fvcPct > 0) charts.push({ label: 'FVC (% Predicted)', percentage: Math.min(100, fvcPct), rawValue: `${fvcPct}%`, color: getPftColor(fvcPct), interpretation: getPftInterpretation(fvcPct) });
  let ratioVal = pre.fev1FvcRatio || test.fev1FvcRatio; if (typeof ratioVal === 'object' && ratioVal?.value) ratioVal = ratioVal.value;
  const ratioPct = extractPftPercentage(ratioVal);
  if (ratioPct !== null && ratioPct > 0) charts.push({ label: 'FEV1/FVC Ratio', percentage: Math.min(100, ratioPct), rawValue: `${ratioPct}%`, color: getRatioColor(ratioPct), interpretation: getRatioInterpretation(ratioPct) });
  const dlcoPct = extractPftPercentage(test.dlco?.percentPredicted || test.dlco?.value || test.dlco);
  if (dlcoPct !== null && dlcoPct > 0) charts.push({ label: 'DLCO (% Predicted)', percentage: Math.min(100, dlcoPct), rawValue: `${dlcoPct}%`, color: getPftColor(dlcoPct), interpretation: getPftInterpretation(dlcoPct) });
  return charts;
};

const PDFLegend = () => (
  <View style={styles.legendContainer}>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#333333' }]} /><Text style={styles.legendText}>Normal (80%+)</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#595959' }]} /><Text style={styles.legendText}>Mild (60-79%)</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#808080' }]} /><Text style={styles.legendText}>Moderate (40-59%)</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#A6A6A6' }]} /><Text style={styles.legendText}>Severe (&lt;40%)</Text></View>
  </View>
);

const PDFBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={styles.barChartRow}>
    <Text style={styles.barLabel}>{String(label)}</Text>
    <View style={styles.barContainer}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, percentage))}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{String(rawValue)}</Text>
    </View>
    {interpretation && <Text style={[styles.barInterpretation, { color }]}>{String(interpretation)}</Text>}
  </View>
);

/* ═══════ OBJECT RENDERERS (recursive, grayscale) ═══════ */
const prettyKey = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
  .replace(/\bFev1\b/i, 'FEV1').replace(/\bFvc\b/i, 'FVC').replace(/\bDlco\b/i, 'DLCO').trim();

const isDisplayObj = (v) => v && typeof v === 'object' && !Array.isArray(v) &&
  (v.value !== undefined || v.percentPredicted !== undefined) &&
  Object.keys(v).every(k => k === 'value' || k === 'percentPredicted');

/* countObjectLeaves: how many printable rows the object yields (for wrap-gating) */
const countObjectLeaves = (val) => {
  if (!hasValue(val) || typeof val !== 'object' || Array.isArray(val)) return val !== undefined ? 1 : 0;
  let n = 0;
  Object.values(val).forEach(v => {
    if (!hasValue(v)) return;
    if (v && typeof v === 'object' && !Array.isArray(v) && !isDisplayObj(v)) n += 1 + countObjectLeaves(v);
    else n += 1;
  });
  return n;
};

const PDFObjectNode = ({ nodeKey, nodeVal, depth }) => {
  if (!hasValue(nodeVal)) return null;
  if (nodeVal === null || typeof nodeVal !== 'object' || Array.isArray(nodeVal) || isDisplayObj(nodeVal)) {
    return <Text style={styles.line}>{'  '.repeat(depth)}{prettyKey(nodeKey)}: {safeString(nodeVal)}</Text>;
  }
  return (
    <View>
      <Text style={[styles.line, { fontFamily: 'Helvetica-Bold' }]}>{'  '.repeat(depth)}{prettyKey(nodeKey)}:</Text>
      {Object.entries(nodeVal).filter(([, v]) => hasValue(v)).map(([k, v], i) => (
        <PDFObjectNode key={i} nodeKey={k} nodeVal={v} depth={depth + 1} />
      ))}
    </View>
  );
};

/* ═══════ MAIN PDF TEMPLATE ═══════ */
const PulmonaryFunctionTestsDocumentPDFTemplate = ({ document: doc }) => {
  const data = doc?.documentData || doc?.data || doc;
  let records = [];

  if (Array.isArray(doc)) {
    records = doc;
  } else if (data?.pulmonary_function_tests) {
    records = Array.isArray(data.pulmonary_function_tests) ? data.pulmonary_function_tests : [data.pulmonary_function_tests];
  } else if (data?.data?.pulmonary_function_tests) {
    records = Array.isArray(data.data.pulmonary_function_tests) ? data.data.pulmonary_function_tests : [data.data.pulmonary_function_tests];
  } else if (Array.isArray(data)) {
    records = data;
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!Array.isArray(records)) records = [];
  const validRecords = records.filter(r => r && typeof r === 'object');

  if (validRecords.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Pulmonary Function Tests</Text></View>
          <Text style={styles.noData}>No pulmonary function tests available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Pulmonary Function Tests</Text></View>
        {validRecords.map((test, idx) => {
          const testDate = test.date || test.testDate;
          const chartData = prepareChartData(test);
          return (
            <View key={idx} wrap={false} minPresenceAhead={80}>
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>PFT {idx + 1} - {formatDate(testDate)}</Text>
              </View>

              {/* Score Overview */}
              {chartData.length > 0 && (
                <View style={styles.chartSection}>
                  <Text style={styles.sectionTitle}>Score Overview</Text>
                  <PDFLegend />
                  {chartData.map((chart, cIdx) => (
                    <PDFBarChart key={cIdx} label={chart.label} percentage={chart.percentage} rawValue={chart.rawValue} color={chart.color} interpretation={chart.interpretation} />
                  ))}
                </View>
              )}

              {/* Test Information */}
              {(hasValue(test.provider) || hasValue(test.technician) || hasValue(test.qualityGrade)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Test Information</Text>
                  {hasValue(test.provider) && <View style={styles.row}><Text style={styles.label}>Provider:</Text><Text style={styles.value}>{String(test.provider || '')}</Text></View>}
                  {hasValue(test.technician) && <View style={styles.row}><Text style={styles.label}>Technician:</Text><Text style={styles.value}>{String(test.technician || '')}</Text></View>}
                  {hasValue(test.qualityGrade) && <View style={styles.row}><Text style={styles.label}>Quality Grade:</Text><Text style={styles.value}>{String(test.qualityGrade || '')}</Text></View>}
                </View>
              )}

              {/* Pre-Bronchodilator */}
              {hasValue(test.preBronchodilator) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Pre-Bronchodilator</Text>
                  {hasValue(test.preBronchodilator?.fev1) && (
                    <Text style={styles.line}>FEV1: {safeString(test.preBronchodilator.fev1.percentPredicted)}{test.preBronchodilator.fev1.percentPredicted ? '% predicted' : ''}</Text>
                  )}
                  {hasValue(test.preBronchodilator?.fvc) && (
                    <Text style={styles.line}>FVC: {safeString(test.preBronchodilator.fvc.percentPredicted)}{test.preBronchodilator.fvc.percentPredicted ? '% predicted' : ''}</Text>
                  )}
                  {test.preBronchodilator?.fev1FvcRatio && (
                    <Text style={styles.line}>FEV1/FVC Ratio: {typeof test.preBronchodilator.fev1FvcRatio === 'object' ? safeString(test.preBronchodilator.fev1FvcRatio) : String(test.preBronchodilator.fev1FvcRatio)}</Text>
                  )}
                </View>
              )}

              {/* Post-Bronchodilator */}
              {hasValue(test.postBronchodilator) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Post-Bronchodilator</Text>
                  {hasValue(test.postBronchodilator?.fev1) && (
                    <Text style={styles.line}>FEV1: {safeString(test.postBronchodilator.fev1.percentPredicted)}{test.postBronchodilator.fev1.percentChange ? ` (${String(test.postBronchodilator.fev1.percentChange)} change)` : ''}</Text>
                  )}
                </View>
              )}

              {/* Interpretation */}
              {(safeString(test.interpretation) || safeString(test.reversibility)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Interpretation</Text>
                  {safeString(test.interpretation) && <Text style={styles.line}>{String(test.interpretation || '')}</Text>}
                  {safeString(test.reversibility) && <Text style={styles.line}>Reversibility: {String(test.reversibility || '')}</Text>}
                </View>
              )}

              {/* Lung Volumes */}
              {(hasValue(test.lungVolumes) || hasValue(test.comprehensiveLungVolumes)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Lung Volumes</Text>
                  {hasValue(test.lungVolumes) && <Text style={styles.line}>{safeString(test.lungVolumes)}</Text>}
                  {hasValue(test.comprehensiveLungVolumes) && <Text style={styles.line}>{safeString(test.comprehensiveLungVolumes)}</Text>}
                </View>
              )}

              {/* Predicted Postoperative FEV1 */}
              {hasValue(test.predictedPostoperativeFev1) && (
                <View style={styles.section} wrap={countObjectLeaves(test.predictedPostoperativeFev1) > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Predicted Postoperative FEV1</Text>
                  {typeof test.predictedPostoperativeFev1 === 'object' && !Array.isArray(test.predictedPostoperativeFev1)
                    ? Object.entries(test.predictedPostoperativeFev1).filter(([, v]) => hasValue(v)).map(([k, v], i) => (
                        <PDFObjectNode key={i} nodeKey={k} nodeVal={v} depth={0} />
                      ))
                    : <Text style={styles.line}>{safeString(test.predictedPostoperativeFev1)}</Text>}
                </View>
              )}

              {/* Diffusion Capacity */}
              {(hasValue(test.dlco) || hasValue(test.dlcoComprehensive)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Diffusion Capacity</Text>
                  {hasValue(test.dlco) && <Text style={styles.line}>DLCO: {safeString(test.dlco)}</Text>}
                  {hasValue(test.dlcoComprehensive) && <Text style={styles.line}>{safeString(test.dlcoComprehensive)}</Text>}
                </View>
              )}

              {/* Bronchodilator Response */}
              {hasValue(test.bronchodilatorResponse) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Bronchodilator Response</Text>
                  <Text style={styles.line}>{safeString(test.bronchodilatorResponse)}</Text>
                </View>
              )}

              {/* Exercise Testing */}
              {(hasValue(test.sixMinuteWalkTest) || hasValue(test.cardiopulmonaryExerciseTest)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Exercise Testing</Text>
                  {hasValue(test.sixMinuteWalkTest) && <Text style={styles.line}>6MWT: {safeString(test.sixMinuteWalkTest)}</Text>}
                  {hasValue(test.cardiopulmonaryExerciseTest) && <Text style={styles.line}>CPET: {safeString(test.cardiopulmonaryExerciseTest)}</Text>}
                </View>
              )}

              {/* Quality */}
              {(hasValue(test.qualityAssessment) || hasValue(test.flowVolumeLoop)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quality Assessment</Text>
                  {hasValue(test.qualityAssessment) && <Text style={styles.line}>{safeString(test.qualityAssessment)}</Text>}
                  {hasValue(test.flowVolumeLoop) && <Text style={styles.line}>Flow-Volume Loop: {safeString(test.flowVolumeLoop)}</Text>}
                </View>
              )}

              {idx < validRecords.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PulmonaryFunctionTestsDocumentPDFTemplate;
