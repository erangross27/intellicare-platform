import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * CardiologyAssessmentDocumentPDFTemplate - December 2025
 *
 * Features:
 * - Bar chart visualization for cardiac metrics (EF, HR, GRACE, TIMI, D2B)
 * - Helvetica font (NOT Courier!)
 * - Category-grouped bar charts
 * - Compact layout for proper page flow
 * - wrap={false} on sections to prevent mid-section page breaks
 */

const filterNulls = (arr) => Array.isArray(arr) ? arr.filter(item => item !== null && item !== undefined) : [];

// ========== STYLES ==========
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.4,
  },
  documentHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#404040',
  },
  documentTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  recordContainer: {
    marginBottom: 16,
  },
  recordHeader: {
    backgroundColor: '#f2f2f2',
    padding: 8,
    marginBottom: 10,
    borderRadius: 4,
  },
  recordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recordTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#222222',
  },
  dateBadge: {
    fontSize: 10,
    color: '#6e6e6e',
  },
  statusBadge: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  statusActive: {
    backgroundColor: '#e8e8e8',
    color: '#333333',
  },
  statusCompleted: {
    backgroundColor: '#e0e0e0',
    color: '#222222',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#222222',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  textRow: {
    marginBottom: 4,
    paddingLeft: 8,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
  },
  value: {
    fontSize: 11,
    color: '#111111',
    lineHeight: 1.5,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  itemNumber: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#6e6e6e',
    minWidth: 16,
  },
  itemText: {
    fontSize: 11,
    color: '#111111',
    flex: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    width: 100,
  },
  fieldValue: {
    fontSize: 11,
    color: '#111111',
    flex: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    marginVertical: 12,
  },
  procedureCard: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#6e6e6e',
  },
  procedureName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#222222',
    marginBottom: 2,
  },
  procedureDetail: {
    fontSize: 10,
    color: '#4b4b4b',
    marginLeft: 8,
    marginBottom: 1,
  },
});

// ========== CHART STYLES ==========
const chartStyles = StyleSheet.create({
  chartSection: {
    marginBottom: 14,
    padding: 10,
    backgroundColor: '#f7f7f7',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  chartTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#222222',
    marginBottom: 8,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 8,
    color: '#6b6b6b',
  },
  categoryHeader: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#6e6e6e',
    marginBottom: 6,
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: '#f2f2f2',
    borderRadius: 3,
  },
  barRow: {
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    marginBottom: 3,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
  },
  barBackground: {
    flex: 1,
    height: 12,
    backgroundColor: '#e5e5e5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    marginLeft: 6,
    minWidth: 40,
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 8,
    marginTop: 1,
    marginLeft: 4,
  },
});

// ========== HELPER FUNCTIONS ==========

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Split text into sentences
const splitIntoSentences = (text) => {
  if (!text) return [];
  return text.split(/\.\s+/).filter(s => s.trim().length > 0).map(s => s.trim() + (s.endsWith('.') ? '' : '.'));
};

// Parentheses-aware comma split
const splitByComma = (text) => {
  if (!text) return [];
  const items = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    else if (char === ',' && parenDepth === 0) {
      if (current.trim()) items.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) items.push(current.trim());
  return items;
};

// Hybrid split - by period first, then by comma for lists
const splitByPeriodThenComma = (text) => {
  if (!text) return [];
  const items = [];
  const sentences = text.split(/\.\s+/).filter(s => s.trim().length > 0);

  for (let sentence of sentences) {
    sentence = sentence.trim().replace(/\.$/, '').trim();
    if (!sentence) continue;

    let commaCount = 0;
    let parenDepth = 0;
    for (let i = 0; i < sentence.length; i++) {
      const char = sentence[i];
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
      else if (char === ',' && parenDepth === 0) {
        commaCount++;
      }
    }

    if (commaCount >= 2) {
      const commaItems = splitByComma(sentence);
      items.push(...commaItems);
    } else {
      items.push(sentence + '.');
    }
  }

  return items;
};

// Parse findings with labels
const parseFindingsWithLabels = (text) => {
  if (!text) return [];
  const groups = [];
  const sentences = text.split(/\.\s+/).filter(s => s.trim().length > 0);

  sentences.forEach(sentence => {
    sentence = sentence.trim().replace(/\.$/, '').trim();
    if (!sentence) return;

    const colonIdx = sentence.indexOf(':');
    if (colonIdx > 0 && colonIdx < 80) {
      const beforeColon = sentence.substring(0, colonIdx);
      const hasParenBefore = beforeColon.includes('(');
      if (!hasParenBefore) {
        const label = beforeColon.trim();
        const content = sentence.substring(colonIdx + 1).trim();
        const items = splitByComma(content);
        if (items.length > 0) {
          groups.push({ label: label, items: items });
          return;
        }
      }
    }
    groups.push({ label: null, items: [sentence + '.'] });
  });

  return groups;
};

// Convert key to label
const keyToLabel = (key) => {
  if (!key) return '';
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

// Format a scalar (booleans -> Yes/No)
const fmtScalarPdf = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

// Render object fields
const renderObjectFields = (obj) => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .filter(([key, val]) => val !== null && val !== undefined && val !== '' && key !== '_id')
    .map(([key, val]) => {
      if (typeof val === 'object' && !Array.isArray(val)) {
        const nestedFields = Object.entries(val)
          .filter(([_, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => `${keyToLabel(k)}: ${fmtScalarPdf(v)}`);
        return { label: keyToLabel(key), value: nestedFields.join(', ') };
      }
      return { label: keyToLabel(key), value: fmtScalarPdf(val) };
    });
};

// ========== SCORE EXTRACTION ==========

// Extract EF from echocardiogram.ejectionFraction (e.g., "45%", "52%")
const extractEF = (record) => {
  const efStr = record?.echocardiogram?.ejectionFraction;
  if (!efStr) return null;
  const match = String(efStr).match(/(\d+)/);
  if (match) {
    return { value: parseInt(match[1], 10), max: 100 };
  }
  return null;
};

// Extract Heart Rate from electrocardiogram.rate
const extractHeartRate = (record) => {
  const rate = record?.electrocardiogram?.rate;
  if (rate && typeof rate === 'number') {
    return { value: rate, max: 150 };
  }
  return null;
};

// Extract GRACE Score from assessment text
const extractGRACE = (record) => {
  const text = String(record?.assessment || '');
  const match = text.match(/GRACE\s*Score\s*[:=]?\s*(\d+)/i);
  if (match) {
    return { value: parseInt(match[1], 10), max: 372 };
  }
  return null;
};

// Extract TIMI Score from assessment text
const extractTIMI = (record) => {
  const text = String(record?.assessment || '');
  const match = text.match(/TIMI\s*(?:Risk\s*)?Score\s*[:=]?\s*(\d+)/i);
  if (match) {
    return { value: parseInt(match[1], 10), max: 7 };
  }
  return null;
};

// Extract Door-to-Balloon time from stemiMetrics
const extractD2B = (record) => {
  const d2b = record?.cardiacCatheterization?.stemiMetrics?.doorToBalloonTime?.minutes;
  if (d2b && typeof d2b === 'number') {
    return { value: d2b, max: 120 };
  }
  return null;
};

// ========== COLOR FUNCTIONS ==========

// PROTECTIVE color coding (higher = better = green)
const getProtectiveColor = (value, max) => {
  const pct = (value / max) * 100;
  if (pct >= 55) return '#9a9a9a'; // Normal EF (green)
  if (pct >= 40) return '#6e6e6e'; // Mildly reduced (blue)
  if (pct >= 30) return '#4a4a4a'; // Moderately reduced (orange)
  return '#1c1c1c'; // Severely reduced (red)
};

// RISK color coding (higher = worse = red)
const getRiskColor = (value, max) => {
  const pct = (value / max) * 100;
  if (pct >= 75) return '#1c1c1c'; // High risk (red)
  if (pct >= 50) return '#4a4a4a'; // Moderate risk (orange)
  if (pct >= 25) return '#6e6e6e'; // Low-moderate (blue)
  return '#9a9a9a'; // Low risk (green)
};

// Heart Rate color coding (60-100 is normal)
const getHeartRateColor = (value) => {
  if (value >= 60 && value <= 100) return '#9a9a9a'; // Normal (green)
  if (value < 60) return '#6e6e6e'; // Bradycardia (blue)
  if (value <= 110) return '#4a4a4a'; // Mild tachycardia (orange)
  return '#1c1c1c'; // Tachycardia (red)
};

// Door-to-Balloon color coding (lower = better)
const getD2BColor = (value) => {
  if (value <= 60) return '#9a9a9a'; // Excellent (green)
  if (value <= 90) return '#6e6e6e'; // Good - meets target (blue)
  if (value <= 120) return '#4a4a4a'; // Delayed (orange)
  return '#1c1c1c'; // Significantly delayed (red)
};

// ========== CLINICAL INTERPRETATIONS ==========
const getEFInterpretation = (value) => {
  if (value >= 55) return 'Normal LV Function';
  if (value >= 40) return 'Mildly Reduced';
  if (value >= 30) return 'Moderately Reduced';
  return 'Severely Reduced';
};

const getHeartRateInterpretation = (value) => {
  if (value < 60) return 'Bradycardia';
  if (value <= 100) return 'Normal';
  return 'Tachycardia';
};

const getGRACEInterpretation = (value) => {
  if (value <= 108) return 'Low Risk (<1% mortality)';
  if (value <= 140) return 'Intermediate Risk';
  return 'High Risk (>3% mortality)';
};

const getTIMIInterpretation = (value) => {
  if (value <= 2) return 'Low Risk';
  if (value <= 4) return 'Intermediate Risk';
  return 'High Risk';
};

const getD2BInterpretation = (value) => {
  if (value <= 60) return 'Excellent - Well Under Target';
  if (value <= 90) return 'Good - Target Met (<90 min)';
  if (value <= 120) return 'Delayed - Target Missed';
  return 'Significantly Delayed';
};

// ========== CHART DATA PREPARATION ==========
const prepareChartData = (record) => {
  const chartData = [];

  // Check if chartData was passed pre-computed (from JSX component)
  if (record.chartData && Array.isArray(record.chartData)) {
    return record.chartData;
  }

  // Cardiac Function
  const ef = extractEF(record);
  if (ef) {
    chartData.push({
      label: 'Ejection Fraction',
      value: ef.value,
      max: ef.max,
      unit: '%',
      category: 'Cardiac Function',
      color: getProtectiveColor(ef.value, ef.max),
      interpretation: getEFInterpretation(ef.value),
    });
  }

  // Vital Signs
  const hr = extractHeartRate(record);
  if (hr) {
    chartData.push({
      label: 'Heart Rate',
      value: hr.value,
      max: hr.max,
      unit: 'bpm',
      category: 'Vital Signs',
      color: getHeartRateColor(hr.value),
      interpretation: getHeartRateInterpretation(hr.value),
    });
  }

  // Cardiac Risk Scores
  const grace = extractGRACE(record);
  if (grace) {
    chartData.push({
      label: 'GRACE Score',
      value: grace.value,
      max: grace.max,
      unit: '',
      category: 'Cardiac Risk Scores',
      color: getRiskColor(grace.value, grace.max),
      interpretation: getGRACEInterpretation(grace.value),
    });
  }

  const timi = extractTIMI(record);
  if (timi) {
    chartData.push({
      label: 'TIMI Score',
      value: timi.value,
      max: timi.max,
      unit: '',
      category: 'Cardiac Risk Scores',
      color: getRiskColor(timi.value, timi.max),
      interpretation: getTIMIInterpretation(timi.value),
    });
  }

  // STEMI Metrics
  const d2b = extractD2B(record);
  if (d2b) {
    chartData.push({
      label: 'Door-to-Balloon Time',
      value: d2b.value,
      max: d2b.max,
      unit: 'min',
      category: 'STEMI Metrics',
      color: getD2BColor(d2b.value),
      interpretation: getD2BInterpretation(d2b.value),
    });
  }

  return chartData;
};

// ========== CHART COMPONENTS ==========

const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#9a9a9a' }]} />
      <Text style={chartStyles.legendText}>Normal/Low Risk</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#6e6e6e' }]} />
      <Text style={chartStyles.legendText}>Mild/Low-Mod</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#4a4a4a' }]} />
      <Text style={chartStyles.legendText}>Moderate</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#1c1c1c' }]} />
      <Text style={chartStyles.legendText}>High Risk/Abnormal</Text>
    </View>
  </View>
);

const PDFBarChart = ({ label, value, max, unit, color, interpretation }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <View style={chartStyles.barRow}>
      <Text style={chartStyles.barLabel}>{String(label)}</Text>
      <View style={chartStyles.barContainer}>
        <View style={chartStyles.barBackground}>
          <View style={[chartStyles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
        </View>
        <Text style={chartStyles.barValue}>{String(value)}{String(unit)}</Text>
      </View>
      <Text style={[chartStyles.barInterpretation, { color }]}>{String(interpretation)}</Text>
    </View>
  );
};

// ========== MAIN COMPONENT ==========

const CardiologyAssessmentDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.cardiology_assessment) {
        return inputData[0].cardiology_assessment;
      }
      return inputData;
    }
    if (inputData.cardiology_assessment) {
      return inputData.cardiology_assessment;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Cardiology Assessment</Text>
        </View>

        {/* Records */}
        {filterNulls(records).map((record, idx) => {
          const chartData = prepareChartData(record);
          const hasChartData = chartData.length > 0;

          // Group charts by category
          const chartCategories = {};
          chartData.forEach(chart => {
            if (!chartCategories[chart.category]) {
              chartCategories[chart.category] = [];
            }
            chartCategories[chart.category].push(chart);
          });

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordHeaderRow}>
                  <Text style={styles.recordTitle}>
                    Assessment {idx + 1}
                    {record.type ? ` - ${String(record.type)}` : ''}
                  </Text>
                  <Text style={styles.dateBadge}>{formatDate(record.date)}</Text>
                </View>
                {record.status && (
                  <View style={[
                    styles.statusBadge,
                    String(record.status).toLowerCase() === 'active' && styles.statusActive,
                    String(record.status).toLowerCase() === 'completed' && styles.statusCompleted
                  ]}>
                    <Text>{String(record.status).toUpperCase()}</Text>
                  </View>
                )}
              </View>

              {/* Cardiac Metrics Overview (Bar Charts) */}
              {hasChartData && (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={chartStyles.chartTitle}>Cardiac Metrics Overview</Text>
                  <PDFLegend />
                  {Object.entries(chartCategories).map(([category, charts], catIdx) => (
                    <View key={catIdx}>
                      <Text style={chartStyles.categoryHeader}>{String(category)}</Text>
                      {charts.map((chart, cIdx) => (
                        <PDFBarChart
                          key={cIdx}
                          label={chart.label}
                          value={chart.value}
                          max={chart.max}
                          unit={chart.unit}
                          color={chart.color}
                          interpretation={chart.interpretation}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Assessment Information */}
              {(record.provider || record.facility || record.type) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment Information</Text>
                  {record.provider && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Provider:</Text>
                      <Text style={styles.fieldValue}>{String(record.provider)}</Text>
                    </View>
                  )}
                  {record.facility && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Facility:</Text>
                      <Text style={styles.fieldValue}>{String(record.facility)}</Text>
                    </View>
                  )}
                  {record.type && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Type:</Text>
                      <Text style={styles.fieldValue}>{String(record.type)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Findings */}
              {record.findings && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  {parseFindingsWithLabels(record.findings).map((group, gIdx) => (
                    <View key={gIdx}>
                      {group.label && (
                        <Text style={[styles.label, { marginBottom: 2, paddingLeft: 8 }]}>{String(group.label)}:</Text>
                      )}
                      {group.items.map((item, iIdx) => (
                        <View key={iIdx} style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{iIdx + 1}.</Text>
                          <Text style={styles.itemText}>{String(item)}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Assessment - HIDDEN when scores are extracted (shown in chart instead) */}
              {record.assessment && !extractGRACE(record) && !extractTIMI(record) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  {splitIntoSentences(record.assessment).map((sentence, sIdx) => (
                    <View key={sIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{sIdx + 1}.</Text>
                      <Text style={styles.itemText}>{String(sentence)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Plan */}
              {record.plan && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  {splitByPeriodThenComma(record.plan).map((item, sIdx) => (
                    <View key={sIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{sIdx + 1}.</Text>
                      <Text style={styles.itemText}>{String(item)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Echocardiogram - HIDDEN when EF is extracted (shown in chart instead) */}
              {record.echocardiogram && Object.keys(record.echocardiogram).length > 0 && !extractEF(record) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Echocardiogram</Text>
                  {renderObjectFields(record.echocardiogram).map((field, fIdx) => (
                    <View key={fIdx} style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{String(field.label)}:</Text>
                      <Text style={styles.fieldValue}>{String(field.value)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Electrocardiogram - HIDDEN when HR is extracted (shown in chart instead) */}
              {record.electrocardiogram && Object.keys(record.electrocardiogram).length > 0 && !extractHeartRate(record) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Electrocardiogram (ECG)</Text>
                  {renderObjectFields(record.electrocardiogram).map((field, fIdx) => (
                    <View key={fIdx} style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{String(field.label)}:</Text>
                      <Text style={styles.fieldValue}>{String(field.value)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Scheduled Procedures */}
              {record.scheduledProcedures && record.scheduledProcedures.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Scheduled Procedures</Text>
                  {filterNulls(record.scheduledProcedures).map((proc, pIdx) => (
                    <View key={pIdx} style={styles.procedureCard}>
                      <Text style={styles.procedureName}>{String(proc.procedureName || 'Procedure')}</Text>
                      {proc.timeframe && <Text style={styles.procedureDetail}>Timeframe: {String(proc.timeframe)}</Text>}
                      {proc.urgency && <Text style={styles.procedureDetail}>Urgency: {String(proc.urgency)}</Text>}
                      {proc.indication && <Text style={styles.procedureDetail}>Indication: {String(proc.indication)}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Recommendations */}
              {record.recommendations && record.recommendations.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {filterNulls(record.recommendations).map((rec, rIdx) => {
                    const recText = typeof rec === 'string' ? rec : rec.recommendation;
                    const recDate = typeof rec === 'object' && rec.date ? ` (${String(rec.date)})` : '';
                    return (
                      <View key={rIdx} style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{rIdx + 1}.</Text>
                        <Text style={styles.itemText}>{String(recText)}{recDate}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* CAD Risk Factors */}
              {record.coronaryArteryDiseaseRiskFactors && Object.keys(record.coronaryArteryDiseaseRiskFactors).length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>CAD Risk Factors</Text>
                  {(() => {
                    const rf = record.coronaryArteryDiseaseRiskFactors;
                    const factors = [];
                    if (rf.smoking && rf.smoking !== 'Not specified') factors.push({ label: 'Smoking', value: rf.smoking });
                    if (rf.hypertension && rf.hypertension !== 'Not specified') factors.push({ label: 'Hypertension', value: rf.hypertension });
                    if (rf.diabetes && rf.diabetes !== 'Not specified') factors.push({ label: 'Diabetes', value: rf.diabetes });
                    if (rf.hyperlipidemia && rf.hyperlipidemia !== 'Not specified') factors.push({ label: 'Hyperlipidemia', value: rf.hyperlipidemia });
                    if (rf.familyHistory && rf.familyHistory !== 'Not specified') factors.push({ label: 'Family History', value: rf.familyHistory });
                    if (rf.obesity && rf.obesity !== 'Not specified') factors.push({ label: 'Obesity', value: rf.obesity });
                    if (rf.sedentaryLifestyle && rf.sedentaryLifestyle !== 'Not specified') factors.push({ label: 'Sedentary Lifestyle', value: rf.sedentaryLifestyle });

                    return (
                      <>
                        {factors.map((f, fIdx) => (
                          <View key={fIdx} style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>{String(f.label)}:</Text>
                            <Text style={styles.fieldValue}>{String(f.value)}</Text>
                          </View>
                        ))}
                        {rf.otherRiskFactors && rf.otherRiskFactors.length > 0 && (
                          <View>
                            <Text style={[styles.label, { marginTop: 4, paddingLeft: 8 }]}>Other Risk Factors:</Text>
                            {filterNulls(rf.otherRiskFactors).map((factor, ofIdx) => (
                              <View key={ofIdx} style={styles.numberedItem}>
                                <Text style={styles.itemNumber}>{ofIdx + 1}.</Text>
                                <Text style={styles.itemText}>{String(factor)}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </>
                    );
                  })()}
                </View>
              )}

              {/* Stress Test */}
              {record.stressTest && Object.keys(record.stressTest).length > 0 && (() => {
                const fields = renderObjectFields(record.stressTest);
                if (fields.length === 0) return null;
                return (
                  <View style={styles.section} wrap={fields.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Stress Test</Text>
                    {fields.map((field, fIdx) => (
                      <View key={fIdx} style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>{String(field.label)}:</Text>
                        <Text style={styles.fieldValue}>{String(field.value)}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Test Results */}
              {record.results && Object.keys(record.results).length > 0 && (() => {
                const fields = renderObjectFields(record.results);
                if (fields.length === 0) return null;
                return (
                  <View style={styles.section} wrap={fields.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Test Results</Text>
                    {fields.map((field, fIdx) => (
                      <View key={fIdx} style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>{String(field.label)}:</Text>
                        <Text style={styles.fieldValue}>{String(field.value)}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Additional Testing Ordered */}
              {record.additionalTestingOrdered && record.additionalTestingOrdered.length > 0 && (
                <View style={styles.section} wrap={record.additionalTestingOrdered.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Additional Testing Ordered</Text>
                  {filterNulls(record.additionalTestingOrdered).map((test, tIdx) => {
                    if (typeof test === 'string') {
                      return (
                        <View key={tIdx} style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{tIdx + 1}.</Text>
                          <Text style={styles.itemText}>{String(test)}</Text>
                        </View>
                      );
                    }
                    return (
                      <View key={tIdx} style={styles.procedureCard}>
                        <Text style={styles.procedureName}>{String(test.testName || 'Test')}</Text>
                        {test.indication && <Text style={styles.procedureDetail}>Indication: {String(test.indication)}</Text>}
                        {test.urgency && <Text style={styles.procedureDetail}>Urgency: {String(test.urgency)}</Text>}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Notes */}
              {record.notes && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={[styles.value, { paddingLeft: 8 }]}>{String(record.notes)}</Text>
                </View>
              )}

              {/* Divider between records */}
              {idx < records.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CardiologyAssessmentDocumentPDFTemplate;
