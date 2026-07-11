import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Echo Reports PDF Template - December 2025 Standards
 * Features: Bar chart visualization for EF and RVSP, Helvetica font, professional layout
 */

const filterNulls = (arr) => Array.isArray(arr) ? arr.filter(item => item !== null && item !== undefined) : [];

// Convert to safe string for PDF
const toSafeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val.value !== undefined) return String(val.value);
    if (val.text !== undefined) return String(val.text);
    return JSON.stringify(val);
  }
  return String(val);
};

// Extract numeric value from string like "55%" or "RVSP 35 mmHg"
const extractNumericValue = (text) => {
  if (!text) return null;
  const str = String(text);

  // Pattern for percentage: "55%"
  const percentMatch = str.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    return { value: parseFloat(percentMatch[1]), type: 'percent' };
  }

  // Pattern for RVSP: "RVSP 35 mmHg", "35 mmHg"
  const mmHgMatch = str.match(/(\d+(?:\.\d+)?)\s*mmHg/i);
  if (mmHgMatch) {
    return { value: parseFloat(mmHgMatch[1]), type: 'mmHg' };
  }

  // Plain number
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return { value: parseFloat(numMatch[1]), type: 'number' };
  }

  return null;
};

// EF Interpretation
const getEFInterpretation = (efValue) => {
  if (efValue === null || efValue === undefined) return { color: '#9ca3af', text: 'Unknown' };
  if (efValue >= 55) return { color: '#898989', text: 'Normal' };
  if (efValue >= 40) return { color: '#7a7a7a', text: 'Mildly Reduced' };
  if (efValue >= 30) return { color: '#a7a7a7', text: 'Moderately Reduced' };
  return { color: '#777777', text: 'Severely Reduced' };
};

// RVSP Interpretation
const getRVSPInterpretation = (rvspValue) => {
  if (rvspValue === null || rvspValue === undefined) return { color: '#9ca3af', text: 'Unknown' };
  if (rvspValue < 35) return { color: '#898989', text: 'Normal' };
  if (rvspValue < 45) return { color: '#7a7a7a', text: 'Mild Elevation' };
  if (rvspValue < 60) return { color: '#a7a7a7', text: 'Moderate Elevation' };
  return { color: '#777777', text: 'Severe Elevation' };
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return '';
  }
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#000000',
    backgroundColor: '#ffffff'
  },
  // Document header
  documentHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#424242'
  },
  documentTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#424242',
    marginBottom: 4,
    textAlign: 'center'
  },
  documentSubtitle: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center'
  },
  // Record container
  recordContainer: {
    marginBottom: 16
  },
  // Record header
  recordHeader: {
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4
  },
  recordDate: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'right',
    marginBottom: 4
  },
  recordTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#424242'
  },
  recordType: {
    fontSize: 11,
    color: '#7a7a7a',
    marginTop: 2
  },
  // Separator
  separator: {
    marginTop: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc'
  },
  // Section styling
  section: {
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#424242',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  // Chart section
  chartSection: {
    marginBottom: 14,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  chartTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#424242',
    marginBottom: 8
  },
  // Legend
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexWrap: 'wrap'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4
  },
  legendText: {
    fontSize: 8,
    color: '#666666'
  },
  // Bar chart
  barChartRow: {
    marginBottom: 10
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 4
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16
  },
  barBackground: {
    flex: 1,
    height: 14,
    backgroundColor: '#e5e5e5',
    borderRadius: 3,
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 3
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginLeft: 8,
    width: 60,
    textAlign: 'right'
  },
  barInterpretation: {
    fontSize: 9,
    marginTop: 2
  },
  barReference: {
    fontSize: 8,
    color: '#888888',
    marginTop: 2
  },
  // Field rows
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8
  },
  fieldLabel: {
    width: 100,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#666666'
  },
  fieldValue: {
    flex: 1,
    fontSize: 10,
    color: '#333333'
  },
  // Text block
  textBlock: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.5,
    paddingLeft: 8
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 30,
    right: 30,
    fontSize: 8,
    color: '#666666',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    paddingTop: 6,
    textAlign: 'center'
  },
  pageNumber: {
    position: 'absolute',
    bottom: 12,
    right: 30,
    fontSize: 8,
    color: '#666666'
  }
});

// Legend Component
const Legend = () => (
  <View style={styles.legendContainer}>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#898989' }]} />
      <Text style={styles.legendText}>Normal</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#7a7a7a' }]} />
      <Text style={styles.legendText}>Mild</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#a7a7a7' }]} />
      <Text style={styles.legendText}>Moderate</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#777777' }]} />
      <Text style={styles.legendText}>Severe</Text>
    </View>
  </View>
);

// Bar Chart Component
const BarChart = ({ label, percentage, rawValue, color, interpretation, referenceRange }) => (
  <View style={styles.barChartRow}>
    <Text style={styles.barLabel}>{label}</Text>
    <View style={styles.barContainer}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, {
          width: `${Math.min(100, Math.max(0, percentage))}%`,
          backgroundColor: color
        }]} />
      </View>
      <Text style={styles.barValue}>{rawValue}</Text>
    </View>
    {interpretation && (
      <Text style={[styles.barInterpretation, { color }]}>{interpretation}</Text>
    )}
    {referenceRange && (
      <Text style={styles.barReference}>Reference: {referenceRange}</Text>
    )}
  </View>
);

// Field Row Component
const FieldRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      <Text style={styles.fieldValue}>{toSafeString(value)}</Text>
    </View>
  );
};

const EchoReportsPDFTemplate = ({ documents }) => {
  const reports = Array.isArray(documents) ? documents : [documents];
  const validReports = filterNulls(reports);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Echocardiogram Reports</Text>
          <Text style={styles.documentSubtitle}>
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {validReports.map((report, reportIdx) => {
          // Prepare chart data
          const chartData = [];

          // Ejection Fraction
          if (report.ejectionFraction) {
            const efExtracted = extractNumericValue(report.ejectionFraction);
            if (efExtracted && efExtracted.value !== null) {
              const interpretation = getEFInterpretation(efExtracted.value);
              chartData.push({
                label: 'Ejection Fraction (EF)',
                percentage: efExtracted.value,
                rawValue: toSafeString(report.ejectionFraction),
                color: interpretation.color,
                interpretation: interpretation.text,
                referenceRange: 'Normal: 55-70%'
              });
            }
          }

          // RVSP from rightVentricle.pressure
          if (report.rightVentricle && report.rightVentricle.pressure) {
            const rvspExtracted = extractNumericValue(report.rightVentricle.pressure);
            if (rvspExtracted && rvspExtracted.value !== null) {
              const interpretation = getRVSPInterpretation(rvspExtracted.value);
              const normalizedPercentage = Math.min(100, (rvspExtracted.value / 80) * 100);
              chartData.push({
                label: 'RVSP',
                percentage: normalizedPercentage,
                rawValue: toSafeString(report.rightVentricle.pressure),
                color: interpretation.color,
                interpretation: interpretation.text,
                referenceRange: 'Normal: <35 mmHg'
              });
            }
          }

          const hasChartData = chartData.length > 0;

          return (
            <View key={reportIdx} style={styles.recordContainer}>
              {/* Record Separator (except first) */}
              {reportIdx > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                {report.date && (
                  <Text style={styles.recordDate}>{formatDate(report.date)}</Text>
                )}
                <Text style={styles.recordTitle}>
                  Echo Report {reportIdx + 1}
                </Text>
                {report.cardiologist && (
                  <Text style={styles.recordType}>{toSafeString(report.cardiologist)}</Text>
                )}
              </View>

              {/* Score Overview - Bar Chart Section */}
              {hasChartData && (
                <View style={styles.chartSection} wrap={false}>
                  <Text style={styles.chartTitle}>Score Overview</Text>
                  <Legend />
                  {chartData.map((chart, chartIdx) => (
                    <BarChart
                      key={chartIdx}
                      label={chart.label}
                      percentage={chart.percentage}
                      rawValue={chart.rawValue}
                      color={chart.color}
                      interpretation={chart.interpretation}
                      referenceRange={chart.referenceRange}
                    />
                  ))}
                </View>
              )}

              {/* Left Ventricle */}
              {report.leftVentricle && typeof report.leftVentricle === 'object' &&
               Object.keys(report.leftVentricle).length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Left Ventricle</Text>
                  {Object.entries(report.leftVentricle).map(([key, value], idx) => (
                    <FieldRow key={idx} label={key} value={value} />
                  ))}
                </View>
              )}

              {/* Right Ventricle */}
              {report.rightVentricle && typeof report.rightVentricle === 'object' &&
               Object.keys(report.rightVentricle).length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Right Ventricle</Text>
                  {Object.entries(report.rightVentricle).map(([key, value], idx) => (
                    <FieldRow key={idx} label={key} value={value} />
                  ))}
                </View>
              )}

              {/* Left Atrium */}
              {report.leftAtrium && typeof report.leftAtrium === 'object' &&
               Object.keys(report.leftAtrium).length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Left Atrium</Text>
                  {Object.entries(report.leftAtrium).map(([key, value], idx) => (
                    <FieldRow key={idx} label={key} value={value} />
                  ))}
                </View>
              )}

              {/* Right Atrium */}
              {report.rightAtrium && typeof report.rightAtrium === 'object' &&
               Object.keys(report.rightAtrium).length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Right Atrium</Text>
                  {Object.entries(report.rightAtrium).map(([key, value], idx) => (
                    <FieldRow key={idx} label={key} value={value} />
                  ))}
                </View>
              )}

              {/* Valves */}
              {Array.isArray(report.valves) && report.valves.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Valves</Text>
                  {filterNulls(report.valves).map((valve, vIdx) => {
                    const valveText = typeof valve === 'object'
                      ? Object.entries(valve).map(([k, v]) => `${k}: ${toSafeString(v)}`).join(', ')
                      : toSafeString(valve);
                    return (
                      <Text key={vIdx} style={styles.textBlock}>
                        {vIdx + 1}. {valveText}
                      </Text>
                    );
                  })}
                </View>
              )}

              {/* Wall Motion */}
              {report.wallMotion && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Wall Motion</Text>
                  <Text style={styles.textBlock}>{toSafeString(report.wallMotion)}</Text>
                </View>
              )}

              {/* Diastolic Function */}
              {report.diastolicFunction && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Diastolic Function</Text>
                  <Text style={styles.textBlock}>{toSafeString(report.diastolicFunction)}</Text>
                </View>
              )}

              {/* Pericardium */}
              {report.pericardium && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Pericardium</Text>
                  <Text style={styles.textBlock}>{toSafeString(report.pericardium)}</Text>
                </View>
              )}

              {/* Conclusion */}
              {report.conclusion && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Conclusion</Text>
                  <Text style={styles.textBlock}>{toSafeString(report.conclusion)}</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Footer */}
        <Text style={styles.footer}>
          PROTECTED HEALTH INFORMATION (PHI) - Handle according to HIPAA regulations
        </Text>

        {/* Page Number */}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `Page ${pageNumber} of ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default EchoReportsPDFTemplate;
