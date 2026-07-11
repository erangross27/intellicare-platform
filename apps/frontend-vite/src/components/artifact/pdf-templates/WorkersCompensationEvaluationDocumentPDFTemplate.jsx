import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  recordCard: {
    marginBottom: 20,
  },
  recordHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#666666',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  fieldBlock: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#333333',
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 12,
    paddingLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  indicatorRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
  },
  indicatorLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    width: 200,
  },
  indicatorValue: {
    fontSize: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 8,
  },
  badge: {
    fontSize: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  // Chart styles
  chartSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 9,
    color: '#666666',
  },
  barChartRow: {
    marginBottom: 14,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  barCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barCategoryValue: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  barInterpretation: {
    fontSize: 9,
    color: '#666666',
  },
  barOuter: {
    height: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barInner: {
    height: 16,
    borderRadius: 4,
  },
  barScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleItem: {
    fontSize: 8,
    color: '#9ca3af',
  },
  nestedSubtitle: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 4,
    marginTop: 4,
  },
  sentenceItem: {
    fontSize: 12,
    paddingLeft: 16,
    marginBottom: 3,
    lineHeight: 1.4,
  },
});

// Safe string helper
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val.$date) return val.$date;
    return '';
  }
  return String(val);
};

// Format date
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return safeString(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(dateValue);
  }
};

// Split text into sentences with title protection (Mr., Dr., etc.)
const splitIntoSentences = (text) => {
  if (!text) return [];
  const textStr = safeString(text);
  // Negative lookbehind to preserve Mr., Dr., Mrs., Ms., Prof., etc.
  const sentences = textStr.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Co|lbs|hrs|min|sec|ft|yds|mi))\.\s+/);
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
};

// Parse item with nested label (Label: value pattern)
const parseItemWithNestedLabel = (text) => {
  if (!text || typeof text !== 'string') return { subtitle: null, value: text };
  const colonIdx = text.indexOf(':');
  if (colonIdx === -1 || colonIdx < 2 || colonIdx > 50) return { subtitle: null, value: text };

  // Skip time patterns like "10:30" - colon between digits
  const charBefore = text[colonIdx - 1];
  const charAfter = text[colonIdx + 1];
  if (/\d/.test(charBefore) && /\d/.test(charAfter)) return { subtitle: null, value: text };

  const beforeColon = text.substring(0, colonIdx).trim();
  const afterColon = text.substring(colonIdx + 1).trim();

  if (!/^[A-Z]/.test(beforeColon) || !afterColon) return { subtitle: null, value: text };
  if (beforeColon.includes('.')) return { subtitle: null, value: text };

  return { subtitle: beforeColon, value: afterColon };
};

// Parse text that may contain Label: value patterns mixed with sentences
const parseFindingsWithLabels = (text) => {
  if (!text) return [];
  const sentences = splitIntoSentences(text);
  const groups = [];
  let currentGroup = null;

  sentences.forEach(sentence => {
    const parsed = parseItemWithNestedLabel(sentence);
    if (parsed.subtitle) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = { label: parsed.subtitle, items: [parsed.value] };
    } else if (currentGroup) {
      currentGroup.items.push(sentence);
    } else {
      groups.push({ label: null, items: [sentence] });
    }
  });

  if (currentGroup) groups.push(currentGroup);
  return groups;
};

// Split by comma - parentheses-aware (preserves "item (detail, detail)")
const splitByComma = (text) => {
  if (!text) return [];
  const items = [];
  let currentItem = '';
  let parenDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(') {
      parenDepth++;
      currentItem += char;
    } else if (char === ')') {
      parenDepth--;
      currentItem += char;
    } else if (char === ',' && parenDepth === 0) {
      const trimmed = currentItem.trim();
      if (trimmed) items.push(trimmed);
      currentItem = '';
    } else {
      currentItem += char;
    }
  }
  const trimmed = currentItem.trim();
  if (trimmed) items.push(trimmed);
  return items;
};

// Hybrid: Split by period first, then by comma within each sentence
const splitByPeriodThenComma = (text) => {
  if (!text) return [];
  const items = [];
  const sentences = splitIntoSentences(text);

  for (let sentence of sentences) {
    sentence = sentence.trim().replace(/\.$/, '').trim();
    if (!sentence) continue;

    // Check if sentence contains commas outside parentheses
    let hasComma = false;
    let parenDepth = 0;
    for (let i = 0; i < sentence.length; i++) {
      const char = sentence[i];
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
      else if (char === ',' && parenDepth === 0) {
        hasComma = true;
        break;
      }
    }

    if (hasComma) {
      items.push(...splitByComma(sentence));
    } else {
      items.push(sentence);
    }
  }
  return items;
};

// Work Status severity
const getWorkStatusSeverity = (status) => {
  if (!status) return null;
  const statusLower = safeString(status).toLowerCase();

  if (statusLower.includes('full duty') || statusLower === 'full') {
    return { label: 'Full Duty', color: '#888888', description: 'Cleared for all work activities', percentage: 100 };
  } else if (statusLower.includes('modified') || statusLower.includes('light duty')) {
    return { label: 'Modified Duty', color: '#444444', description: 'Work with restrictions', percentage: 60 };
  } else if (statusLower.includes('off work') || statusLower.includes('disability')) {
    return { label: 'Off Work', color: '#222222', description: 'Unable to work', percentage: 20 };
  }
  return { label: status, color: '#666666', description: 'Current work status', percentage: 50 };
};

// Apportionment severity
const getApportionmentSeverity = (percentage) => {
  if (percentage === null || percentage === undefined) return null;
  const pct = Number(percentage);
  if (isNaN(pct)) return null;

  if (pct >= 90) {
    return { label: `${pct}% Work-Related`, color: '#222222', description: 'Primarily occupational', percentage: pct };
  } else if (pct >= 50) {
    return { label: `${pct}% Work-Related`, color: '#444444', description: 'Significant contribution', percentage: pct };
  } else if (pct >= 25) {
    return { label: `${pct}% Work-Related`, color: '#666666', description: 'Partial contribution', percentage: pct };
  }
  return { label: `${pct}% Work-Related`, color: '#888888', description: 'Minor contribution', percentage: pct };
};

// Impairment severity
const getImpairmentSeverity = (rating) => {
  if (rating === null || rating === undefined) return null;
  const pct = Number(rating);
  if (isNaN(pct)) return null;

  if (pct === 0) {
    return { label: 'No Impairment', color: '#888888', description: 'No permanent disability', percentage: 5 };
  } else if (pct <= 10) {
    return { label: `${pct}% Impairment`, color: '#666666', description: 'Mild impairment', percentage: Math.max(pct, 10) };
  } else if (pct <= 25) {
    return { label: `${pct}% Impairment`, color: '#444444', description: 'Moderate impairment', percentage: pct };
  }
  return { label: `${pct}% Impairment`, color: '#222222', description: 'Significant impairment', percentage: pct };
};

// PDF Legend
const PDFLegend = ({ type }) => {
  if (type === 'workStatus') {
    return (
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#888888' }]} />
          <Text style={styles.legendText}>Full Duty</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#444444' }]} />
          <Text style={styles.legendText}>Modified Duty</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#222222' }]} />
          <Text style={styles.legendText}>Off Work</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.legendContainer}>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: '#888888' }]} />
        <Text style={styles.legendText}>Minimal (0-24%)</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: '#666666' }]} />
        <Text style={styles.legendText}>Mild (25-49%)</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: '#444444' }]} />
        <Text style={styles.legendText}>Moderate (50-89%)</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: '#222222' }]} />
        <Text style={styles.legendText}>Significant (90-100%)</Text>
      </View>
    </View>
  );
};

// PDF Bar Chart
const PDFBarChart = ({ label, severity }) => {
  if (!severity) return null;
  return (
    <View style={styles.barChartRow}>
      <Text style={styles.barLabel}>{String(label)}</Text>
      <View style={styles.barCategoryRow}>
        <Text style={[styles.barCategoryValue, { color: severity.color }]}>{String(severity.label)}</Text>
        <Text style={styles.barInterpretation}>{String(severity.description)}</Text>
      </View>
      <View style={styles.barOuter}>
        <View style={[styles.barInner, { width: `${severity.percentage}%`, backgroundColor: severity.color }]} />
      </View>
      <View style={styles.barScale}>
        <Text style={styles.scaleItem}>0%</Text>
        <Text style={styles.scaleItem}>25%</Text>
        <Text style={styles.scaleItem}>50%</Text>
        <Text style={styles.scaleItem}>75%</Text>
        <Text style={styles.scaleItem}>100%</Text>
      </View>
    </View>
  );
};

const WorkersCompensationEvaluationDocumentPDFTemplate = ({ document }) => {
  const records = Array.isArray(document) ? document : [document];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Workers' Compensation Evaluation</Text>
        </View>

        {records.map((record, recordIdx) => {
          const workStatusSeverity = getWorkStatusSeverity(record.workStatus);
          const apportionmentSeverity = getApportionmentSeverity(record.apportionmentPercentage);
          const impairmentSeverity = getImpairmentSeverity(record.permanentImpairmentRating);

          return (
            <View key={recordIdx} style={styles.recordCard}>
              {/* Record Header */}
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>Workers' Compensation Evaluation {recordIdx + 1}</Text>
                <Text style={styles.dateText}>{formatDate(record.date)}</Text>
                {workStatusSeverity && (
                  <Text style={[styles.statusBadge, { backgroundColor: `${workStatusSeverity.color}30`, color: workStatusSeverity.color }]}>
                    {String(workStatusSeverity.label)}
                  </Text>
                )}
              </View>

              {/* Claim Information */}
              {(record.date || record.injuryDate || record.dateReportedToEmployer || record.claimNumber || record.employerName || record.occupationTitle) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Claim Information</Text>
                  {record.date && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Evaluation Date</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                    </View>
                  )}
                  {record.injuryDate && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Injury Date</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.injuryDate)}</Text>
                    </View>
                  )}
                  {record.dateReportedToEmployer && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Date Reported to Employer</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.dateReportedToEmployer)}</Text>
                    </View>
                  )}
                  {record.claimNumber && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Claim Number</Text>
                      <Text style={styles.fieldValue}>{String(record.claimNumber)}</Text>
                    </View>
                  )}
                  {record.employerName && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Employer</Text>
                      <Text style={styles.fieldValue}>{String(record.employerName)}</Text>
                    </View>
                  )}
                  {record.occupationTitle && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Occupation</Text>
                      <Text style={styles.fieldValue}>{String(record.occupationTitle)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Work Status Chart */}
              {workStatusSeverity && (
                <View style={styles.chartSection} wrap={false}>
                  <Text style={styles.chartTitle}>Work Status Assessment</Text>
                  <PDFLegend type="workStatus" />
                  <PDFBarChart label="Current Work Status" severity={workStatusSeverity} />
                </View>
              )}

              {/* Work Restrictions - Pattern 2: title + first item with label:value parsing */}
              {record.workRestrictions && record.workRestrictions.length > 0 && (() => {
                const restrictions = record.workRestrictions;
                const firstRestriction = restrictions[0];
                const restRestrictions = restrictions.slice(1);
                const firstParsed = parseItemWithNestedLabel(firstRestriction);

                return (
                  <View style={styles.section}>
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>Work Restrictions</Text>
                      {firstParsed.subtitle ? (
                        <View style={styles.fieldBlock}>
                          <Text style={styles.nestedSubtitle}>{String(firstParsed.subtitle)}</Text>
                          <Text style={styles.sentenceItem}>{String(firstParsed.value)}</Text>
                        </View>
                      ) : (
                        <Text style={styles.listItem}>1. {String(firstRestriction)}</Text>
                      )}
                    </View>
                    {restRestrictions.map((r, rIdx) => {
                      const parsed = parseItemWithNestedLabel(r);
                      if (parsed.subtitle) {
                        return (
                          <View key={rIdx} style={styles.fieldBlock}>
                            <Text style={styles.nestedSubtitle}>{String(parsed.subtitle)}</Text>
                            <Text style={styles.sentenceItem}>{String(parsed.value)}</Text>
                          </View>
                        );
                      }
                      return <Text key={rIdx} style={styles.listItem}>{rIdx + 2}. {String(r)}</Text>;
                    })}
                  </View>
                );
              })()}

              {/* MMI & Return to Work */}
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>MMI & Return to Work</Text>
                <View style={styles.indicatorRow}>
                  <Text style={styles.indicatorLabel}>Maximum Medical Improvement:</Text>
                  <Text style={styles.indicatorValue}>{record.maxMedicalImprovement ? 'Yes - Reached' : 'No - Not Yet'}</Text>
                </View>
                {record.mmiDate && (
                  <View style={styles.indicatorRow}>
                    <Text style={styles.indicatorLabel}>MMI Date:</Text>
                    <Text style={styles.indicatorValue}>{formatDate(record.mmiDate)}</Text>
                  </View>
                )}
                {record.returnToWorkDate && (
                  <View style={styles.indicatorRow}>
                    <Text style={styles.indicatorLabel}>Return to Work Date:</Text>
                    <Text style={styles.indicatorValue}>{formatDate(record.returnToWorkDate)}</Text>
                  </View>
                )}
                {record.lostWorkDays !== undefined && (
                  <View style={styles.indicatorRow}>
                    <Text style={styles.indicatorLabel}>Lost Work Days:</Text>
                    <Text style={styles.indicatorValue}>{String(record.lostWorkDays)} days</Text>
                  </View>
                )}
              </View>

              {/* Causality & Apportionment */}
              {(record.causalityOpinion || record.apportionmentPercentage !== undefined) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Causality & Apportionment</Text>
                    {apportionmentSeverity && (
                      <View style={styles.chartSection}>
                        <PDFLegend type="apportionment" />
                        <PDFBarChart label="Occupational Apportionment" severity={apportionmentSeverity} />
                      </View>
                    )}
                  </View>
                  {record.causalityOpinion && (() => {
                    const sentences = splitIntoSentences(record.causalityOpinion);
                    return (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldSubtitle}>Causality Opinion</Text>
                        {sentences.map((sentence, sIdx) => (
                          <Text key={sIdx} style={styles.sentenceItem}>
                            {sIdx + 1}. {String(sentence + (sentence.endsWith('.') ? '' : '.'))}
                          </Text>
                        ))}
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Impairment Assessment */}
              {(record.permanentImpairmentRating !== undefined || record.functionalCapacityEvaluation) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Impairment Assessment</Text>
                  {impairmentSeverity && (
                    <View style={styles.chartSection}>
                      <PDFBarChart label="Permanent Impairment Rating" severity={impairmentSeverity} />
                    </View>
                  )}
                  {record.functionalCapacityEvaluation && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Functional Capacity Evaluation</Text>
                      <Text style={styles.fieldValue}>{String(record.functionalCapacityEvaluation)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Injury Details */}
              {(record.injuryMechanism || (record.bodyPartsAffected && record.bodyPartsAffected.length > 0)) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Injury Details</Text>
                    {record.injuryMechanism && (() => {
                      const sentences = splitIntoSentences(record.injuryMechanism);
                      const firstSentence = sentences[0];
                      return (
                        <View style={styles.fieldBlock}>
                          <Text style={styles.fieldSubtitle}>Mechanism of Injury</Text>
                          {firstSentence && (
                            <Text style={styles.sentenceItem}>
                              1. {String(firstSentence + (firstSentence.endsWith('.') ? '' : '.'))}
                            </Text>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                  {record.injuryMechanism && (() => {
                    const sentences = splitIntoSentences(record.injuryMechanism);
                    const restSentences = sentences.slice(1);
                    return restSentences.map((sentence, sIdx) => (
                      <Text key={sIdx} style={styles.sentenceItem}>
                        {sIdx + 2}. {String(sentence + (sentence.endsWith('.') ? '' : '.'))}
                      </Text>
                    ));
                  })()}
                  {record.bodyPartsAffected && record.bodyPartsAffected.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Body Parts Affected</Text>
                      {record.bodyPartsAffected.map((part, pIdx) => (
                        <Text key={pIdx} style={styles.listItem}>{pIdx + 1}. {String(part)}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Treatment & Future Care - Pattern 2 */}
              {(record.treatmentAuthorization || (record.futureCareMedicalNeeds && record.futureCareMedicalNeeds.length > 0)) && (() => {
                const needs = record.futureCareMedicalNeeds || [];
                const firstNeed = needs[0];
                const restNeeds = needs.slice(1);

                return (
                  <View style={styles.section}>
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>Treatment & Future Care</Text>
                      {record.treatmentAuthorization && (
                        <View style={styles.fieldBlock}>
                          <Text style={styles.fieldSubtitle}>Treatment Authorization</Text>
                          <Text style={styles.fieldValue}>{String(record.treatmentAuthorization)}</Text>
                        </View>
                      )}
                      <View style={styles.indicatorRow}>
                        <Text style={styles.indicatorLabel}>Vocational Rehabilitation:</Text>
                        <Text style={styles.indicatorValue}>{record.vocationalRehabilitation ? 'Yes - Required' : 'No - Not Required'}</Text>
                      </View>
                      {firstNeed && (
                        <>
                          <Text style={[styles.fieldSubtitle, { paddingLeft: 8, marginTop: 8 }]}>Future Care Needs</Text>
                          <Text style={styles.listItem}>1. {String(firstNeed)}</Text>
                        </>
                      )}
                    </View>
                    {restNeeds.map((need, nIdx) => (
                      <Text key={nIdx} style={styles.listItem}>{nIdx + 2}. {String(need)}</Text>
                    ))}
                  </View>
                );
              })()}

              {/* Job Requirements */}
              {(record.jobDemandAnalysis || record.modifiedDutyOptions) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Job Requirements</Text>
                  </View>
                  {record.jobDemandAnalysis && (() => {
                    const items = splitByPeriodThenComma(record.jobDemandAnalysis);
                    return (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldSubtitle}>Job Demand Analysis</Text>
                        {items.map((item, iIdx) => {
                          const parsed = parseItemWithNestedLabel(item);
                          if (parsed.subtitle) {
                            return (
                              <View key={iIdx}>
                                <Text style={styles.nestedSubtitle}>{String(parsed.subtitle)}</Text>
                                <Text style={styles.sentenceItem}>{String(parsed.value)}</Text>
                              </View>
                            );
                          }
                          return (
                            <Text key={iIdx} style={styles.sentenceItem}>
                              {iIdx + 1}. {String(item)}
                            </Text>
                          );
                        })}
                      </View>
                    );
                  })()}
                  {record.modifiedDutyOptions && (() => {
                    const groups = parseFindingsWithLabels(record.modifiedDutyOptions);
                    return (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldSubtitle}>Modified Duty Options</Text>
                        {groups.map((group, gIdx) => (
                          <View key={gIdx}>
                            {group.label && (
                              <Text style={styles.nestedSubtitle}>{String(group.label)}</Text>
                            )}
                            {group.items.map((item, iIdx) => (
                              <Text key={iIdx} style={styles.sentenceItem}>
                                {iIdx + 1}. {String(item + (item.endsWith('.') ? '' : '.'))}
                              </Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Prior Work Injuries */}
              {record.priorWorkInjuries && record.priorWorkInjuries.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Prior Work Injuries</Text>
                  {record.priorWorkInjuries.map((injury, iIdx) => (
                    <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {String(injury)}</Text>
                  ))}
                </View>
              )}

              {/* Insurance */}
              {record.insuranceCarrier && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Insurance</Text>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Insurance Carrier</Text>
                    <Text style={styles.fieldValue}>{String(record.insuranceCarrier)}</Text>
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

export default WorkersCompensationEvaluationDocumentPDFTemplate;
