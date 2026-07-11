import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PostOperativeReportsDocumentPDFTemplate - December 2025 Standards
 * Helvetica font, bar chart visualization for Pain Level Progression, numbered lists
 */

// Chart Styles
const chartStyles = StyleSheet.create({
  chartSection: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    marginBottom: 10,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
    fontSize: 9,
    color: '#727272',
  },
  barChartRow: {
    marginBottom: 10,
  },
  barLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    width: 40,
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 9,
    marginTop: 2,
    paddingLeft: 2,
  },
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 16,
    borderBottom: '2pt solid #404040',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#666666',
  },
  recordCard: {
    marginBottom: 20,
  },
  recordHeader: {
    backgroundColor: '#f0f7ff',
    padding: 10,
    marginBottom: 12,
    borderRadius: 4,
    borderLeft: '4pt solid #404040',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  recordMeta: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  metaItem: {
    fontSize: 11,
    color: '#666666',
    marginRight: 16,
  },
  section: {
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: '1pt solid #e5e7eb',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    width: 140,
  },
  fieldValue: {
    fontSize: 11,
    color: '#1f2937',
    flex: 1,
  },
  listItem: {
    fontSize: 11,
    color: '#1f2937',
    marginLeft: 12,
    marginBottom: 4,
    lineHeight: 1.5,
  },
  labeledGroup: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#404040',
  },
  labeledTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    marginBottom: 2,
  },
  labeledValue: {
    fontSize: 11,
    color: '#1f2937',
    paddingLeft: 8,
    marginBottom: 1,
  },
  recItem: {
    marginBottom: 4,
    marginLeft: 12,
  },
  recDateText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    marginBottom: 1,
  },
  recText: {
    fontSize: 11,
    color: '#1f2937',
    lineHeight: 1.5,
  },
});

// Format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Split by comma (parentheses-aware)
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

// Split into sentences
const splitIntoSentences = (text) => {
  if (!text) return [];
  return text.split(/\.\s+/).filter(s => s.trim().length > 0).map(s => s.trim() + (s.endsWith('.') ? '' : '.'));
};

// Parse POD-labeled text
const parsePODLabels = (text) => {
  if (!text) return [];
  const parts = text.split(/(?=POD\s*\d+:)/i).filter(s => s.trim());
  return parts.map(part => part.trim());
};

// Parse labeled sections
const parseLabeledSections = (text) => {
  if (!text) return [];
  const parts = text.split(/\.\s+(?=[A-Z]|POD)/).filter(s => s.trim());
  return parts.map(part => {
    let cleaned = part.trim();
    if (!cleaned.endsWith('.')) cleaned += '.';
    return cleaned;
  });
};

// Safe string helper
const toSafeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (Object.keys(val).length === 0) return '';
    return JSON.stringify(val);
  }
  return String(val);
};

// ============================================
// BAR CHART FUNCTIONS - Pain Level Progression
// ============================================

// Extract pain scores from painLevel text
const extractPainScores = (painLevelText) => {
  if (!painLevelText) return [];
  const scores = [];

  // Pattern 1: POD-labeled scores (POD 0: 2/10, POD 3-5: 5-6/10)
  const podPattern = /POD\s*(\d+(?:-\d+)?)\s*:\s*(\d+(?:-\d+)?)\s*\/\s*10/gi;
  let match;
  while ((match = podPattern.exec(painLevelText)) !== null) {
    const podLabel = `POD ${match[1]}`;
    const scoreText = match[2];
    const scoreVal = scoreText.includes('-')
      ? Math.max(...scoreText.split('-').map(Number))
      : parseInt(scoreText, 10);
    scores.push({ label: podLabel, score: scoreVal, raw: `${scoreText}/10` });
  }

  // Pattern 2: Simple scores without POD label
  if (scores.length === 0) {
    const simplePattern = /(\d+(?:-\d+)?)\s*\/\s*10/g;
    let idx = 0;
    while ((match = simplePattern.exec(painLevelText)) !== null) {
      const scoreText = match[1];
      const scoreVal = scoreText.includes('-')
        ? Math.max(...scoreText.split('-').map(Number))
        : parseInt(scoreText, 10);
      scores.push({
        label: idx === 0 ? 'Current' : `Score ${idx + 1}`,
        score: scoreVal,
        raw: `${scoreText}/10`
      });
      idx++;
    }
  }

  return scores;
};

// Pain score color coding (RISK: higher = worse = red)
const getPainColor = (score) => {
  if (score <= 2) return '#9a9a9a';   // Light gray - Minimal/No pain
  if (score <= 4) return '#6f6f6f';   // Mid gray - Mild pain
  if (score <= 6) return '#4a4a4a';   // Dark gray - Moderate pain
  return '#222222';                    // Darkest gray - Severe pain
};

// Pain score interpretation
const getPainInterpretation = (score) => {
  if (score === 0) return 'No Pain';
  if (score <= 2) return 'Minimal Pain';
  if (score <= 4) return 'Mild Pain';
  if (score <= 6) return 'Moderate Pain';
  if (score <= 8) return 'Severe Pain';
  return 'Worst Pain';
};

// PDF Legend Component
const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#9a9a9a' }]} />
      <Text style={chartStyles.legendText}>Minimal (0-2)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#6f6f6f' }]} />
      <Text style={chartStyles.legendText}>Mild (3-4)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#4a4a4a' }]} />
      <Text style={chartStyles.legendText}>Moderate (5-6)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#222222' }]} />
      <Text style={chartStyles.legendText}>Severe (7-10)</Text>
    </View>
  </View>
);

// PDF Bar Chart Component
const PDFBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={chartStyles.barChartRow}>
    <Text style={chartStyles.barLabel}>{String(label)}</Text>
    <View style={chartStyles.barContainer}>
      <View style={chartStyles.barBackground}>
        <View style={[chartStyles.barFill, { width: `${Math.min(100, percentage)}%`, backgroundColor: color }]} />
      </View>
      <Text style={chartStyles.barValue}>{String(rawValue)}</Text>
    </View>
    <Text style={[chartStyles.barInterpretation, { color }]}>{String(interpretation)}</Text>
  </View>
);

const PostOperativeReportsDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.post_operative_reports && Array.isArray(data.post_operative_reports)) {
    records = data.post_operative_reports;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.post_operative_reports) {
      records = docData.post_operative_reports;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Post-Operative Reports</Text>
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {/* Records */}
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {record.procedurePerformed || `Post-Operative Report ${idx + 1}`}
              </Text>
              <View style={styles.recordMeta}>
                {record.surgeryDate && (
                  <Text style={styles.metaItem}>Surgery Date: {formatDate(record.surgeryDate)}</Text>
                )}
              </View>
            </View>

            {/* Pain Level Progression Bar Chart - December 2025 */}
            {(() => {
              const painScores = extractPainScores(toSafeString(record.painLevel));
              if (painScores.length === 0) return null;

              const chartData = painScores.map(ps => ({
                label: ps.label,
                percentage: (ps.score / 10) * 100,
                rawValue: ps.raw,
                color: getPainColor(ps.score),
                interpretation: getPainInterpretation(ps.score)
              }));

              return (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={chartStyles.chartTitle}>Pain Level Progression</Text>
                  <PDFLegend />
                  {chartData.map((chart, cIdx) => (
                    <PDFBarChart
                      key={cIdx}
                      label={chart.label}
                      percentage={chart.percentage}
                      rawValue={chart.rawValue}
                      color={chart.color}
                      interpretation={chart.interpretation}
                    />
                  ))}
                </View>
              );
            })()}

            {/* Surgery Information */}
            {(record.procedurePerformed || record.surgicalFindings) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Surgery Information</Text>
                {record.procedurePerformed && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Procedure:</Text>
                    <Text style={styles.fieldValue}>{String(record.procedurePerformed || '')}</Text>
                  </View>
                )}
                {record.surgicalFindings && splitIntoSentences(record.surgicalFindings).map((finding, fIdx) => (
                  <Text key={fIdx} style={styles.listItem}>{fIdx + 1}. {String(finding || '')}</Text>
                ))}
              </View>
            )}

            {/* Complications */}
            {record.complications && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Complications</Text>
                {parsePODLabels(record.complications).map((comp, cIdx) => (
                  <Text key={cIdx} style={styles.listItem}>{cIdx + 1}. {String(comp || '')}</Text>
                ))}
              </View>
            )}

            {/* PACU Information */}
            {(record.pacuArrival || record.pacuDischarge) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>PACU Information</Text>
                {record.pacuArrival && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>PACU Arrival:</Text>
                    <Text style={styles.fieldValue}>{String(record.pacuArrival || '')}</Text>
                  </View>
                )}
                {record.pacuDischarge && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>PACU Discharge:</Text>
                    <Text style={styles.fieldValue}>{String(record.pacuDischarge || '')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Vital Signs */}
            {record.vitalSignsTrend && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Vital Signs</Text>
                {parseLabeledSections(record.vitalSignsTrend).map((vital, vIdx) => (
                  <Text key={vIdx} style={styles.listItem}>{vIdx + 1}. {String(vital || '')}</Text>
                ))}
              </View>
            )}

            {/* Pain Management - Note: painLevel shown in bar chart above, only show medications here */}
            {record.painManagement && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Pain Management</Text>
                {splitByComma(record.painManagement).map((med, mIdx) => (
                  <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {String(med || '')}</Text>
                ))}
              </View>
            )}

            {/* Recovery Status */}
            {(record.nausea || record.urineOutput || record.drainOutput || record.oxygenRequirement) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Recovery Status</Text>
                {record.nausea && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Nausea/Vomiting:</Text>
                    <Text style={styles.fieldValue}>{String(record.nausea || '')}</Text>
                  </View>
                )}
                {record.urineOutput && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Urine Output:</Text>
                    <Text style={styles.fieldValue}>{String(record.urineOutput || '')}</Text>
                  </View>
                )}
                {record.drainOutput && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Drain Output:</Text>
                    <Text style={styles.fieldValue}>{String(record.drainOutput || '')}</Text>
                  </View>
                )}
                {record.oxygenRequirement && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Oxygen:</Text>
                    <Text style={styles.fieldValue}>{String(record.oxygenRequirement || '')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Mobility Status */}
            {record.mobilityStatus && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Mobility Status</Text>
                {parsePODLabels(record.mobilityStatus).map((mob, mobIdx) => (
                  <Text key={mobIdx} style={styles.listItem}>{mobIdx + 1}. {String(mob || '')}</Text>
                ))}
              </View>
            )}

            {/* Diet & Disposition */}
            {(record.diet || record.disposition) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Diet & Disposition</Text>
                {record.diet && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Diet:</Text>
                    <Text style={styles.fieldValue}>{String(record.diet || '')}</Text>
                  </View>
                )}
                {record.disposition && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Disposition:</Text>
                    <Text style={styles.fieldValue}>{String(record.disposition || '')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Discharge Instructions - Only show if there are actual items */}
            {(() => {
              const instrItems = splitByComma(record.dischargeInstructions);
              if (instrItems.length === 0) return null;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Discharge Instructions</Text>
                  {instrItems.map((instr, iIdx) => (
                    <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {String(instr || '')}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Follow-Up Plan - Only show if there are actual items */}
            {(() => {
              const fuItems = splitByComma(record.followUpPlan);
              if (fuItems.length === 0) return null;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Follow-Up Plan</Text>
                  {fuItems.map((fu, fuIdx) => (
                    <Text key={fuIdx} style={styles.listItem}>{fuIdx + 1}. {String(fu || '')}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Prescriptions - Only show if there are actual items */}
            {(() => {
              const rxItems = splitByComma(record.prescriptions);
              if (rxItems.length === 0) return null;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Prescriptions</Text>
                  {rxItems.map((rx, rxIdx) => (
                    <Text key={rxIdx} style={styles.listItem}>{rxIdx + 1}. {String(rx || '')}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Activity Restrictions - Only show if there are actual items */}
            {(() => {
              const restItems = splitByComma(record.activityRestrictions);
              if (restItems.length === 0) return null;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Activity Restrictions</Text>
                  {restItems.map((rest, restIdx) => (
                    <Text key={restIdx} style={styles.listItem}>{restIdx + 1}. {String(rest || '')}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Return Precautions - Only show if there are actual items */}
            {(() => {
              const precItems = splitByComma(record.returnPrecautions);
              if (precItems.length === 0) return null;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Return Precautions</Text>
                  {precItems.map((prec, precIdx) => (
                    <Text key={precIdx} style={styles.listItem}>{precIdx + 1}. {String(prec || '')}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Recommendations - array of {recommendation, date} */}
            {Array.isArray(record.recommendations) && record.recommendations.filter(Boolean).length > 0 && (
              <View style={styles.section} wrap={record.recommendations.filter(Boolean).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {record.recommendations.filter(Boolean).map((rec, recIdx) => {
                  const isObj = typeof rec === 'object' && rec !== null;
                  const recText = isObj ? (rec.recommendation || '') : String(rec);
                  const recDate = isObj ? rec.date : null;
                  return (
                    <View key={recIdx} style={styles.recItem}>
                      {recDate && <Text style={styles.recDateText}>[{formatDate(recDate)}]</Text>}
                      <Text style={styles.recText}>{recIdx + 1}. {String(recText || '')}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PostOperativeReportsDocumentPDFTemplate;
