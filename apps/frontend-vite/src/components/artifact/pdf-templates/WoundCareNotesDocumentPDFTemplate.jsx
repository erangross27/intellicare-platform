import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * WoundCareNotesDocumentPDFTemplate - March 2026 Standard
 * BLACK & WHITE PDF with Helvetica font, LETTER size, 20pt/12pt
 * Pain Level (0-10) with risk color coding (higher = worse = red)
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
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
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordHeader: {
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
  recordMeta: {
    flexDirection: 'row',
    marginTop: 4,
  },
  metaItem: {
    fontSize: 10,
    color: '#333333',
    marginRight: 16,
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
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 150,
  },
  fieldValue: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 16,
    marginBottom: 4,
  },
  nestedLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    paddingLeft: 16,
    marginTop: 4,
    marginBottom: 2,
  },
  nestedValue: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 24,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
});

// Chart styles
const chartStyles = StyleSheet.create({
  chartSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  legendColor: {
    width: 12,
    height: 12,
    marginRight: 4,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 9,
    color: '#333333',
  },
  barChartRow: {
    marginBottom: 12,
  },
  barLabel: {
    fontSize: 11,
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
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginLeft: 8,
    width: 40,
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 10,
    marginTop: 2,
    paddingLeft: 4,
  },
});

// Pain Level color coding (RISK: higher = worse = red)
const getPainScoreColor = (painLevel) => {
  if (painLevel === 0) return '#cccccc';
  if (painLevel <= 3) return '#999999';
  if (painLevel <= 6) return '#555555';
  return '#000000';
};

const getPainInterpretation = (painLevel) => {
  if (painLevel === 0) return 'No Pain';
  if (painLevel <= 3) return 'Mild Pain (1-3)';
  if (painLevel <= 6) return 'Moderate Pain (4-6)';
  return 'Severe Pain (7-10)';
};

// PDF Legend component
const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#cccccc' }]} />
      <Text style={chartStyles.legendText}>No Pain (0)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#999999' }]} />
      <Text style={chartStyles.legendText}>Mild (1-3)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#555555' }]} />
      <Text style={chartStyles.legendText}>Moderate (4-6)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#000000' }]} />
      <Text style={chartStyles.legendText}>Severe (7-10)</Text>
    </View>
  </View>
);

// PDF BarChart component
const PDFBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
  <View style={chartStyles.barChartRow}>
    <Text style={chartStyles.barLabel}>{String(label)}</Text>
    <View style={chartStyles.barContainer}>
      <View style={chartStyles.barBackground}>
        <View style={[chartStyles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={chartStyles.barValue}>{String(rawValue)}</Text>
    </View>
    <Text style={[chartStyles.barInterpretation, { color }]}>{String(interpretation)}</Text>
  </View>
);

// Object-field helpers (recursive, B&W)
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
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
  const LabelTag = depth > 0 ? styles.nestedLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.nestedValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

// Parse text with "Label: content" patterns
const parseLabeledText = (text) => {
  if (!text) return [];
  const labelRegex = /(?:^|\.\s*)([A-Za-z][A-Za-z\s]{1,30}?):\s*/g;
  const results = [];
  let match;
  let lastIndex = 0;
  let currentLabel = null;

  while ((match = labelRegex.exec(text)) !== null) {
    if (currentLabel !== null) {
      const content = text.substring(lastIndex, match.index).trim();
      if (content) {
        const cleanContent = content.replace(/\.\s*$/, '').trim();
        results.push({ label: currentLabel, value: cleanContent });
      }
    }
    currentLabel = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  if (currentLabel !== null) {
    const content = text.substring(lastIndex).trim();
    if (content) {
      const cleanContent = content.replace(/\.\s*$/, '').trim();
      results.push({ label: currentLabel, value: cleanContent });
    }
  }

  return results;
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
    return String(dateString);
  }
};

const WoundCareNotesDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.wound_care_notes && Array.isArray(data.wound_care_notes)) {
    records = data.wound_care_notes;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.wound_care_notes) {
      records = docData.wound_care_notes;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  // Filter valid records
  const validRecords = records.filter(r => r && typeof r === 'object');

  if (validRecords.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Wound Care Notes</Text>
          </View>
          <Text style={styles.noData}>No wound care notes data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Wound Care Notes</Text>
        </View>

        {/* Records */}
        {validRecords.map((record, idx) => {
          // Prepare chart data
          const hasPainLevel = record.painLevel !== undefined && record.painLevel !== null;
          let chartData = null;
          if (hasPainLevel) {
            const painLevel = Number(record.painLevel);
            chartData = {
              label: 'Pain Intensity Score',
              percentage: (painLevel / 10) * 100,
              rawValue: `${painLevel}/10`,
              color: getPainScoreColor(painLevel),
              interpretation: getPainInterpretation(painLevel)
            };
          }

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>
                  Wound Care Note {idx + 1}{record.woundLocation ? ` - ${String(record.woundLocation)}` : ''}
                </Text>
                {record.date && (
                  <View style={styles.recordMeta}>
                    <Text style={styles.metaItem}>Date: {formatDate(record.date)}</Text>
                  </View>
                )}
              </View>

              {/* Score Overview - Bar Chart Section */}
              {chartData && (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={chartStyles.chartTitle}>Score Overview</Text>
                  <PDFLegend />
                  <PDFBarChart
                    label={chartData.label}
                    percentage={chartData.percentage}
                    rawValue={chartData.rawValue}
                    color={chartData.color}
                    interpretation={chartData.interpretation}
                  />
                </View>
              )}

              {/* General Information */}
              {(record.provider || record.facility) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>General Information</Text>
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
                </View>
              )}

              {/* Wound Information */}
              {(record.woundLocation || record.woundType || record.woundStage) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Wound Information</Text>
                  {record.woundLocation && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Location:</Text>
                      <Text style={styles.fieldValue}>{String(record.woundLocation)}</Text>
                    </View>
                  )}
                  {record.woundType && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Type:</Text>
                      <Text style={styles.fieldValue}>{String(record.woundType)}</Text>
                    </View>
                  )}
                  {record.woundStage && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Stage:</Text>
                      <Text style={styles.fieldValue}>{String(record.woundStage)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Wound Dimensions (object) */}
              {!isEmptyDeep(record.woundDimensions) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Wound Dimensions</Text>
                  {Object.entries(record.woundDimensions).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `wdim-${k}`, 1))}
                </View>
              )}

              {/* Undermining (object) */}
              {!isEmptyDeep(record.undermining) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Undermining</Text>
                  {Object.entries(record.undermining).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `under-${k}`, 1))}
                </View>
              )}

              {/* Tunneling (object) */}
              {!isEmptyDeep(record.tunneling) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Tunneling</Text>
                  {Object.entries(record.tunneling).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `tun-${k}`, 1))}
                </View>
              )}

              {/* Wound Assessment */}
              {(record.woundBed || record.woundEdges || record.exudateAmount || record.exudateType || record.periwoundSkin || record.odorPresent) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Wound Assessment</Text>
                  {record.woundBed && (() => {
                    const labeled = parseLabeledText(record.woundBed);
                    if (labeled.length > 0) {
                      return (
                        <View>
                          <Text style={styles.fieldLabel}>Wound Bed:</Text>
                          {labeled.map((item, lIdx) => (
                            <View key={lIdx}>
                              <Text style={styles.nestedLabel}>{String(item.label)}:</Text>
                              <Text style={styles.nestedValue}>{String(item.value)}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    }
                    return (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Wound Bed:</Text>
                        <Text style={styles.fieldValue}>{String(record.woundBed)}</Text>
                      </View>
                    );
                  })()}
                  {record.woundEdges && (() => {
                    const labeled = parseLabeledText(record.woundEdges);
                    if (labeled.length > 0) {
                      return (
                        <View>
                          <Text style={styles.fieldLabel}>Wound Edges:</Text>
                          {labeled.map((item, lIdx) => (
                            <View key={lIdx}>
                              <Text style={styles.nestedLabel}>{String(item.label)}:</Text>
                              <Text style={styles.nestedValue}>{String(item.value)}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    }
                    return (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Wound Edges:</Text>
                        <Text style={styles.fieldValue}>{String(record.woundEdges)}</Text>
                      </View>
                    );
                  })()}
                  {record.exudateAmount && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Exudate Amount:</Text>
                      <Text style={styles.fieldValue}>{String(record.exudateAmount)}</Text>
                    </View>
                  )}
                  {record.exudateType && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Exudate Type:</Text>
                      <Text style={styles.fieldValue}>{String(record.exudateType)}</Text>
                    </View>
                  )}
                  {record.periwoundSkin && (() => {
                    const labeled = parseLabeledText(record.periwoundSkin);
                    if (labeled.length > 0) {
                      return (
                        <View>
                          <Text style={styles.fieldLabel}>Periwound Skin:</Text>
                          {labeled.map((item, lIdx) => (
                            <View key={lIdx}>
                              <Text style={styles.nestedLabel}>{String(item.label)}:</Text>
                              <Text style={styles.nestedValue}>{String(item.value)}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    }
                    return (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Periwound Skin:</Text>
                        <Text style={styles.fieldValue}>{String(record.periwoundSkin)}</Text>
                      </View>
                    );
                  })()}
                  {record.odorPresent && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Odor Present:</Text>
                      <Text style={styles.fieldValue}>{String(record.odorPresent)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Signs of Infection */}
              {record.signsOfInfection && Array.isArray(record.signsOfInfection) && record.signsOfInfection.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Signs of Infection</Text>
                  {record.signsOfInfection.map((sign, signIdx) => (
                    <Text key={signIdx} style={styles.listItem}>{signIdx + 1}. {String(sign)}</Text>
                  ))}
                </View>
              )}

              {/* Treatment */}
              {(record.cleansingAgent || record.debridementMethod) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Treatment</Text>
                  {record.cleansingAgent && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Cleansing Agent:</Text>
                      <Text style={styles.fieldValue}>{String(record.cleansingAgent)}</Text>
                    </View>
                  )}
                  {record.debridementMethod && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Debridement:</Text>
                      <Text style={styles.fieldValue}>{String(record.debridementMethod)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Dressing */}
              {(record.primaryDressing || record.secondaryDressing || record.dressingChangeFrequency || record.offloadingDevice || record.photographicDocumentation) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Dressing</Text>
                  {record.primaryDressing && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Primary:</Text>
                      <Text style={styles.fieldValue}>{String(record.primaryDressing)}</Text>
                    </View>
                  )}
                  {record.secondaryDressing && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Secondary:</Text>
                      <Text style={styles.fieldValue}>{String(record.secondaryDressing)}</Text>
                    </View>
                  )}
                  {record.dressingChangeFrequency && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Change Frequency:</Text>
                      <Text style={styles.fieldValue}>{String(record.dressingChangeFrequency)}</Text>
                    </View>
                  )}
                  {record.offloadingDevice && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Offloading Device:</Text>
                      <Text style={styles.fieldValue}>{String(record.offloadingDevice)}</Text>
                    </View>
                  )}
                  {record.photographicDocumentation && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Photo Documentation:</Text>
                      <Text style={styles.fieldValue}>{String(record.photographicDocumentation)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Topical Agents */}
              {record.topicalAgents && Array.isArray(record.topicalAgents) && record.topicalAgents.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Topical Agents</Text>
                  {record.topicalAgents.map((agent, agentIdx) => (
                    <Text key={agentIdx} style={styles.listItem}>{agentIdx + 1}. {String(agent)}</Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default WoundCareNotesDocumentPDFTemplate;
