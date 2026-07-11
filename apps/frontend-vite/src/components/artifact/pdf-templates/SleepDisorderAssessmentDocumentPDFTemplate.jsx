import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * SleepDisorderAssessmentDocumentPDFTemplate - Professional Table Layout
 * December 2025 Standard - Clean, readable tables with clear structure
 * Helvetica font, large fonts, professional medical report format
 */

// Styles for professional table layout
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  // Document Header
  documentHeader: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  // Record Container
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 16,
  },
  recordTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  recordDate: {
    fontSize: 10,
    color: '#333333',
    marginTop: 4,
  },
  // Section styling
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    backgroundColor: '#e8e8e8',
    padding: 8,
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 0,
  },
  // Table styling
  table: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableCellLabel: {
    width: '40%',
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderRightWidth: 1,
    borderRightColor: '#cccccc',
  },
  tableCellValue: {
    width: '60%',
    padding: 8,
  },
  cellLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  cellValue: {
    fontSize: 10,
    color: '#000000',
  },
  // Score Overview Table
  scoreTable: {
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#e8e8e8',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  scoreHeaderCell: {
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#cccccc',
  },
  scoreHeaderCellLast: {
    padding: 8,
  },
  scoreHeaderText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  scoreRowLast: {
    flexDirection: 'row',
  },
  scoreCell: {
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#cccccc',
  },
  scoreCellLast: {
    padding: 8,
  },
  scoreCellText: {
    fontSize: 10,
    color: '#000000',
  },
  scoreCellTextBold: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  // Risk indicator cell with color
  riskCell: {
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#cccccc',
    alignItems: 'center',
  },
  riskIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Legend
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 8,
    color: '#666666',
  },
  // Bar Chart Styles
  barChartContainer: {
    marginTop: 8,
  },
  barChartRow: {
    marginBottom: 12,
  },
  barChartLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 4,
  },
  barChartWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: 16,
    borderRadius: 4,
  },
  barValueContainer: {
    width: 50,
    marginLeft: 8,
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  barInterpretation: {
    fontSize: 9,
    marginTop: 2,
    fontFamily: 'Helvetica-Bold',
  },
  // List items in table
  listContainer: {
    paddingLeft: 0,
  },
  listItem: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 4,
  },
  // Boolean indicator
  booleanYes: {
    fontSize: 10,
    color: '#898989',
    fontFamily: 'Helvetica-Bold',
  },
  booleanNo: {
    fontSize: 10,
    color: '#666666',
  },
  noData: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
});

// Clinical score interpretation using actual score ranges (not percentages)
// Each assessment has its own clinically validated thresholds

// Epworth Sleepiness Scale (ESS): 0-24
// 0-5: Normal, 6-10: Mild, 11-12: Moderate, 13-24: Severe
const getESSInterpretation = (score) => {
  if (score <= 5) return { color: '#898989', text: 'Normal', range: '0-5' };
  if (score <= 10) return { color: '#7a7a7a', text: 'Mild Sleepiness', range: '6-10' };
  if (score <= 12) return { color: '#a7a7a7', text: 'Moderate Sleepiness', range: '11-12' };
  return { color: '#777777', text: 'Severe Sleepiness', range: '13-24' };
};

// Pittsburgh Sleep Quality Index (PSQI): 0-21
// 0-4: Good, 5-10: Poor, 11-21: Very Poor
const getPSQIInterpretation = (score) => {
  if (score <= 4) return { color: '#898989', text: 'Good Sleep Quality', range: '0-4' };
  if (score <= 10) return { color: '#a7a7a7', text: 'Poor Sleep Quality', range: '5-10' };
  return { color: '#777777', text: 'Very Poor Sleep', range: '11-21' };
};

// STOP-BANG Score: 0-8
// 0-2: Low Risk, 3-4: Intermediate, 5-8: High Risk
const getSTOPBANGInterpretation = (score) => {
  if (score <= 2) return { color: '#898989', text: 'Low OSA Risk', range: '0-2' };
  if (score <= 4) return { color: '#a7a7a7', text: 'Intermediate OSA Risk', range: '3-4' };
  return { color: '#777777', text: 'High OSA Risk', range: '5-8' };
};

// Mallampati Score: 1-4
// Class I: Low Risk, Class II: Low-Moderate, Class III: Moderate, Class IV: High Risk
const getMallampatiInterpretation = (score) => {
  if (score === 1) return { color: '#898989', text: 'Class I - Easy Airway', range: '1' };
  if (score === 2) return { color: '#7a7a7a', text: 'Class II - Moderate', range: '2' };
  if (score === 3) return { color: '#a7a7a7', text: 'Class III - Difficult', range: '3' };
  return { color: '#777777', text: 'Class IV - Very Difficult', range: '4' };
};

// Prepare chart data for a record
const prepareChartData = (record) => {
  const charts = [];

  // Epworth Sleepiness Scale (0-24)
  if (record.epworthSleepinessScore != null) {
    const value = parseFloat(record.epworthSleepinessScore);
    if (!isNaN(value) && value >= 0) {
      const interp = getESSInterpretation(value);
      const percentage = (value / 24) * 100;
      charts.push({
        label: 'Epworth Sleepiness Scale (ESS)',
        percentage,
        rawValue: `${value}/24`,
        color: interp.color,
        interpretation: interp.text
      });
    }
  }

  // Pittsburgh Sleep Quality Index (0-21)
  if (record.pittsburghSleepQualityIndex != null) {
    const value = parseFloat(record.pittsburghSleepQualityIndex);
    if (!isNaN(value) && value >= 0) {
      const interp = getPSQIInterpretation(value);
      const percentage = (value / 21) * 100;
      charts.push({
        label: 'Pittsburgh Sleep Quality Index (PSQI)',
        percentage,
        rawValue: `${value}/21`,
        color: interp.color,
        interpretation: interp.text
      });
    }
  }

  // STOP-BANG Score (0-8)
  if (record.stopBangScore != null) {
    const value = parseFloat(record.stopBangScore);
    if (!isNaN(value) && value >= 0) {
      const interp = getSTOPBANGInterpretation(value);
      const percentage = (value / 8) * 100;
      charts.push({
        label: 'STOP-BANG Score (OSA Risk)',
        percentage,
        rawValue: `${value}/8`,
        color: interp.color,
        interpretation: interp.text
      });
    }
  }

  // Mallampati Score (1-4)
  if (record.mallampatiScore != null) {
    const value = parseFloat(record.mallampatiScore);
    if (!isNaN(value) && value >= 1 && value <= 4) {
      const interp = getMallampatiInterpretation(value);
      const percentage = ((value - 1) / 3) * 100;
      charts.push({
        label: 'Mallampati Score (Airway)',
        percentage,
        rawValue: `${value}/4`,
        color: interp.color,
        interpretation: interp.text
      });
    }
  }

  return charts;
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Format boolean with styling
const formatBoolean = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
};

// Table Row Component
const TableRow = ({ label, value, isLast = false }) => (
  <View style={isLast ? styles.tableRowLast : styles.tableRow}>
    <View style={styles.tableCellLabel}>
      <Text style={styles.cellLabel}>{String(label)}</Text>
    </View>
    <View style={styles.tableCellValue}>
      <Text style={styles.cellValue}>{String(value)}</Text>
    </View>
  </View>
);

// Boolean Row Component with colored indicator
const BooleanRow = ({ label, value, isLast = false }) => (
  <View style={isLast ? styles.tableRowLast : styles.tableRow}>
    <View style={styles.tableCellLabel}>
      <Text style={styles.cellLabel}>{String(label)}</Text>
    </View>
    <View style={styles.tableCellValue}>
      <Text style={value === true ? styles.booleanYes : styles.booleanNo}>
        {formatBoolean(value)}
      </Text>
    </View>
  </View>
);

// List Row Component
const ListRow = ({ label, items, isLast = false }) => (
  <View style={isLast ? styles.tableRowLast : styles.tableRow}>
    <View style={styles.tableCellLabel}>
      <Text style={styles.cellLabel}>{String(label)}</Text>
    </View>
    <View style={styles.tableCellValue}>
      <View style={styles.listContainer}>
        {items.map((item, idx) => (
          <Text key={idx} style={styles.listItem}>
            {idx + 1}. {String(item)}
          </Text>
        ))}
      </View>
    </View>
  </View>
);

// Score Legend - Shows risk levels (score ranges shown in interpretation column)
const ScoreLegend = () => (
  <View style={styles.legendContainer}>
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: '#898989' }]} />
      <Text style={styles.legendText}>Normal/Low</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: '#7a7a7a' }]} />
      <Text style={styles.legendText}>Mild</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: '#a7a7a7' }]} />
      <Text style={styles.legendText}>Moderate</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: '#777777' }]} />
      <Text style={styles.legendText}>High/Severe</Text>
    </View>
  </View>
);

// Bar Chart Component for PDF
const BarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={styles.barChartRow}>
    <Text style={styles.barChartLabel}>{String(label)}</Text>
    <View style={styles.barChartWrapper}>
      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(100, Math.max(0, percentage))}%`,
              backgroundColor: color
            }
          ]}
        />
      </View>
      <View style={styles.barValueContainer}>
        <Text style={styles.barValue}>{String(rawValue)}</Text>
      </View>
    </View>
    <Text style={[styles.barInterpretation, { color }]}>{String(interpretation)}</Text>
  </View>
);

const SleepDisorderAssessmentDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.sleep_disorder_assessment && Array.isArray(data.sleep_disorder_assessment)) {
    records = data.sleep_disorder_assessment;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.sleep_disorder_assessment) {
      records = docData.sleep_disorder_assessment;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sleep Disorder Assessment</Text>
          </View>
          <Text style={styles.noData}>No assessment data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Sleep Disorder Assessment Report</Text>
        </View>

        {records.map((record, idx) => {
          const chartData = prepareChartData(record);

          return (
            <View key={idx} style={styles.recordContainer} minPresenceAhead={80}>
              {/* Record Header */}
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>Assessment {idx + 1}</Text>
                {record.date && (
                  <Text style={styles.recordDate}>Date: {formatDate(record.date)}</Text>
                )}
                {record.status && (
                  <Text style={styles.recordDate}>Status: {String(record.status)}</Text>
                )}
              </View>

              {/* Score Overview with Bar Charts */}
              {chartData.length > 0 && (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Score Overview</Text>
                  <ScoreLegend />
                  <View style={styles.barChartContainer}>
                    {chartData.map((chart, cIdx) => (
                      <BarChart
                        key={cIdx}
                        label={chart.label}
                        percentage={chart.percentage}
                        rawValue={chart.rawValue}
                        color={chart.color}
                        interpretation={chart.interpretation}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Sleep Metrics Table */}
              {(record.averageSleepDuration != null || record.sleepLatency != null || record.nighttimeAwakenings != null) && (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Sleep Metrics</Text>
                  <View style={styles.table}>
                    {record.averageSleepDuration != null && (
                      <TableRow label="Average Sleep Duration" value={`${record.averageSleepDuration} hours`} />
                    )}
                    {record.sleepLatency != null && (
                      <TableRow label="Sleep Latency" value={`${record.sleepLatency} minutes`} />
                    )}
                    {record.nighttimeAwakenings != null && (
                      <TableRow
                        label="Nighttime Awakenings"
                        value={`${record.nighttimeAwakenings} per night`}
                        isLast={true}
                      />
                    )}
                  </View>
                </View>
              )}

              {/* Symptoms Table */}
              {(record.snoringFrequency || record.witnessedApneas !== undefined ||
                record.restlessLegSymptoms !== undefined || record.periodicLimbMovements !== undefined) && (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Symptoms</Text>
                  <View style={styles.table}>
                    {record.snoringFrequency && (
                      <TableRow label="Snoring Frequency" value={record.snoringFrequency} />
                    )}
                    {record.witnessedApneas !== undefined && (
                      <BooleanRow label="Witnessed Apneas" value={record.witnessedApneas} />
                    )}
                    {record.restlessLegSymptoms !== undefined && (
                      <BooleanRow label="Restless Leg Symptoms" value={record.restlessLegSymptoms} />
                    )}
                    {record.periodicLimbMovements !== undefined && (
                      <BooleanRow label="Periodic Limb Movements" value={record.periodicLimbMovements} isLast={true} />
                    )}
                  </View>
                </View>
              )}

              {/* Disorder Classifications Table */}
              {((record.parasomniaType && record.parasomniaType.length > 0) ||
                record.insomniaSubtype || record.circadianRhythmDisorder) && (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Disorder Classifications</Text>
                  <View style={styles.table}>
                    {record.parasomniaType && record.parasomniaType.length > 0 && (
                      <ListRow label="Parasomnia Type" items={record.parasomniaType} />
                    )}
                    {record.insomniaSubtype && (
                      <TableRow label="Insomnia Subtype" value={record.insomniaSubtype} />
                    )}
                    {record.circadianRhythmDisorder && (
                      <TableRow label="Circadian Rhythm Disorder" value={record.circadianRhythmDisorder} isLast={true} />
                    )}
                  </View>
                </View>
              )}

              {/* Physical Exam Table */}
              {(record.neckCircumference != null || record.mallampatiScore != null) && (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Physical Examination</Text>
                  <View style={styles.table}>
                    {record.neckCircumference != null && (
                      <TableRow label="Neck Circumference" value={`${record.neckCircumference} cm`} />
                    )}
                    {record.mallampatiScore != null && (
                      <TableRow label="Mallampati Score" value={`${record.mallampatiScore}/4`} isLast={true} />
                    )}
                  </View>
                </View>
              )}

              {/* Narcolepsy Symptoms Table */}
              {(record.cataplexyPresent !== undefined || record.sleepParalysisFrequency ||
                record.hypnagogicHallucinations !== undefined) && (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Narcolepsy Symptoms</Text>
                  <View style={styles.table}>
                    {record.cataplexyPresent !== undefined && (
                      <BooleanRow label="Cataplexy Present" value={record.cataplexyPresent} />
                    )}
                    {record.sleepParalysisFrequency && (
                      <TableRow label="Sleep Paralysis Frequency" value={record.sleepParalysisFrequency} />
                    )}
                    {record.hypnagogicHallucinations !== undefined && (
                      <BooleanRow label="Hypnagogic Hallucinations" value={record.hypnagogicHallucinations} isLast={true} />
                    )}
                  </View>
                </View>
              )}

              {/* Sleep Environment Table */}
              {(record.bedtimeRoutine || record.caffeineIntakeDaily != null ||
                (record.sleepEnvironmentIssues && record.sleepEnvironmentIssues.length > 0)) && (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Sleep Environment</Text>
                  <View style={styles.table}>
                    {record.bedtimeRoutine && (
                      <TableRow label="Bedtime Routine" value={record.bedtimeRoutine} />
                    )}
                    {record.caffeineIntakeDaily != null && (
                      <TableRow label="Caffeine Intake" value={`${record.caffeineIntakeDaily} mg/day`} />
                    )}
                    {record.sleepEnvironmentIssues && record.sleepEnvironmentIssues.length > 0 && (
                      <ListRow label="Environment Issues" items={record.sleepEnvironmentIssues} isLast={true} />
                    )}
                  </View>
                </View>
              )}

              {/* Prior Testing Table */}
              {(record.priorPolysomnographyDate || record.apneaHypopneaIndex != null || record.oxygenDesaturationIndex != null) && (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Prior Testing</Text>
                  <View style={styles.table}>
                    {record.priorPolysomnographyDate && (
                      <TableRow label="Prior Polysomnography Date" value={formatDate(record.priorPolysomnographyDate)} />
                    )}
                    {record.apneaHypopneaIndex != null && (
                      <TableRow label="Apnea-Hypopnea Index (AHI)" value={`${record.apneaHypopneaIndex} events/hour`} />
                    )}
                    {record.oxygenDesaturationIndex != null && (
                      <TableRow label="Oxygen Desaturation Index (ODI)" value={`${record.oxygenDesaturationIndex} events/hour`} isLast={true} />
                    )}
                  </View>
                </View>
              )}

              {/* CPAP Compliance Table */}
              {record.currentCpapCompliance !== undefined && (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>CPAP Compliance</Text>
                  <View style={styles.table}>
                    <BooleanRow label="Current CPAP Compliance" value={record.currentCpapCompliance} isLast={true} />
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default SleepDisorderAssessmentDocumentPDFTemplate;
