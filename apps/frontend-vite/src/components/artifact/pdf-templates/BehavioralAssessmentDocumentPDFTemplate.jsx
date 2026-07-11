/**
 * BehavioralAssessmentDocumentPDFTemplate.jsx - December 2025
 *
 * PDF export template for behavioral_assessment collection.
 * Uses Helvetica font, 14pt minimum for readability.
 * Print-friendly: WHITE background, BLACK text.
 * Memory: 692ad78e839d71706b2e39e5 (PDF Standard)
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PDF Styles - Print-friendly (WHITE background, BLACK text)
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    color: '#424242',
    textAlign: 'center',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1px solid #e5e7eb',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#3b3b3b',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#606060',
    borderBottom: '1px solid #e8e8e8',
    paddingBottom: 4,
  },
  fieldBlock: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 4,
    paddingLeft: 12,
  },
  subSection: {
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 8,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#4b5563',
    marginBottom: 4,
  },
  // Bar Chart styles for PDF (print-friendly)
  chartSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    border: '1px solid #e5e7eb',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#3b3b3b',
    marginBottom: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 60,
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
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginLeft: 8,
    width: 50,
    textAlign: 'right',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    color: '#000000',
  },
  statusBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusCompleted: {
    color: '#484848',
    backgroundColor: '#f0f0f0',
  },
  statusPending: {
    color: '#535353',
    backgroundColor: '#f1f1f1',
  },
});

// Helper: Safe string conversion for PDF
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  // Replace problematic Unicode for Helvetica
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  return str;
};

// Helper: Format date
const formatDate = (dateVal) => {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal.$date || dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return 'N/A';
  }
};

// Helper: Check if value exists
const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

// Helper: Split by comma, ignoring parentheses
const splitByCommaIgnoreParentheses = (text) => {
  if (!text || typeof text !== 'string') return [];
  const items = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) items.push(trimmed);
      current = '';
      continue;
    }
    current += char;
  }
  const lastTrimmed = current.trim();
  if (lastTrimmed) items.push(lastTrimmed);
  return items;
};

// Helper: Split by sentence
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
};

// Helper: Parse PSC-17 score from findings
const parsePSC17Score = (findings) => {
  if (!findings || typeof findings !== 'string') return null;
  const match = findings.match(/PSC[-\s]?17[^:]*:\s*Score\s*(\d+)\s*\(normal\s*<\s*(\d+)\)/i);
  if (match) {
    return {
      score: parseInt(match[1], 10),
      threshold: parseInt(match[2], 10),
    };
  }
  return null;
};

// Helper: Get bar color for SYMPTOM type (lower = better)
const getSymptomBarColor = (score, threshold) => {
  const percentage = (score / threshold) * 100;
  if (percentage < 67) return '#898989'; // Green - normal
  if (percentage < 100) return '#bfbfbf'; // Yellow - borderline
  return '#777777'; // Red - concerning
};

const BehavioralAssessmentDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  // Unwrap data
  const unwrappedData = (() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item.records && Array.isArray(item.records)) {
          return item.records;
        }
        return [item];
      });
    }
    if (templateData.records && Array.isArray(templateData.records)) {
      return templateData.records;
    }
    return [templateData];
  })();

  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Behavioral Assessment</Text>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>
            No behavioral assessment data available.
          </Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Behavioral Assessment</Text>

        {unwrappedData.map((record, recordIndex) => {
          const psc17Score = parsePSC17Score(record.findings);

          return (
            <View key={recordIndex} style={styles.recordContainer}>
              {/* Record Title */}
              <View wrap={false}>
                <Text style={styles.recordTitle}>
                  Behavioral Assessment {recordIndex + 1}
                </Text>
              </View>

              {/* Assessment Information */}
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Assessment Information</Text>
                {hasValue(record.date) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                  </View>
                )}
                {hasValue(record.type) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Type</Text>
                    <Text style={styles.fieldValue}>{safeString(record.type)}</Text>
                  </View>
                )}
                {hasValue(record.provider) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Provider</Text>
                    <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                  </View>
                )}
                {hasValue(record.facility) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Facility</Text>
                    <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                  </View>
                )}
                {hasValue(record.status) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Status</Text>
                    <Text style={[
                      styles.statusBadge,
                      record.status?.toLowerCase() === 'completed' ? styles.statusCompleted : styles.statusPending
                    ]}>
                      {safeString(record.status)}
                    </Text>
                  </View>
                )}
              </View>

              {/* PSC-17 Score (Bar Chart) */}
              {psc17Score && (
                <View style={styles.chartSection} wrap={false}>
                  <Text style={styles.chartTitle}>Pediatric Symptom Checklist (PSC-17)</Text>
                  <View style={styles.barRow}>
                    <Text style={styles.barLabel}>Score</Text>
                    <View style={styles.barBackground}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((psc17Score.score / psc17Score.threshold) * 100, 100)}%`,
                            backgroundColor: getSymptomBarColor(psc17Score.score, psc17Score.threshold),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{psc17Score.score}/{psc17Score.threshold}</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#898989' }]} />
                      <Text style={styles.legendText}>Normal (&lt;10)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#bfbfbf' }]} />
                      <Text style={styles.legendText}>Borderline (10-14)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#777777' }]} />
                      <Text style={styles.legendText}>{'Concerning (>=15)'}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Behavioral Observations */}
              {(hasValue(record.temperament) || hasValue(record.attentionSpan) || hasValue(record.activityLevel) || hasValue(record.emotionalRegulation)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Behavioral Observations</Text>
                  {hasValue(record.temperament) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Temperament</Text>
                      <Text style={styles.fieldValue}>{safeString(record.temperament)}</Text>
                    </View>
                  )}
                  {hasValue(record.attentionSpan) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Attention Span</Text>
                      <Text style={styles.fieldValue}>{safeString(record.attentionSpan)}</Text>
                    </View>
                  )}
                  {hasValue(record.activityLevel) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Activity Level</Text>
                      <Text style={styles.fieldValue}>{safeString(record.activityLevel)}</Text>
                    </View>
                  )}
                  {hasValue(record.emotionalRegulation) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Emotional Regulation</Text>
                      <Text style={styles.fieldValue}>{safeString(record.emotionalRegulation)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Social Skills */}
              {hasValue(record.socialSkills) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Social Skills</Text>
                  </View>
                  {splitByCommaIgnoreParentheses(record.socialSkills).map((skill, idx) => (
                    <Text key={idx} style={styles.listItem} wrap={false}>
                      {idx + 1}. {safeString(skill)}
                    </Text>
                  ))}
                </View>
              )}

              {/* Tantrums */}
              {hasValue(record.tantrums) && (hasValue(record.tantrums.frequency) || (hasValue(record.tantrums.triggers) && record.tantrums.triggers.length > 0)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Tantrums</Text>
                  {hasValue(record.tantrums.frequency) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Frequency</Text>
                      <Text style={styles.fieldValue}>{safeString(record.tantrums.frequency)}</Text>
                    </View>
                  )}
                  {hasValue(record.tantrums.triggers) && record.tantrums.triggers.length > 0 && (
                    <View style={styles.subSection}>
                      <Text style={styles.subSectionTitle}>Triggers</Text>
                      {record.tantrums.triggers.map((trigger, idx) => (
                        <Text key={idx} style={styles.listItem}>
                          {idx + 1}. {safeString(trigger)}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Symptom Screening */}
              {(hasValue(record.anxietySymptoms) && record.anxietySymptoms.length > 0 ||
                hasValue(record.adhdSymptoms) && record.adhdSymptoms.length > 0 ||
                hasValue(record.autismRedFlags) && record.autismRedFlags.length > 0) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Symptom Screening</Text>
                  </View>
                  {hasValue(record.anxietySymptoms) && record.anxietySymptoms.length > 0 && (
                    <View style={styles.subSection}>
                      <Text style={styles.subSectionTitle}>Anxiety Symptoms</Text>
                      {record.anxietySymptoms.map((symptom, idx) => (
                        <Text key={idx} style={styles.listItem} wrap={false}>
                          {idx + 1}. {safeString(symptom)}
                        </Text>
                      ))}
                    </View>
                  )}
                  {hasValue(record.adhdSymptoms) && record.adhdSymptoms.length > 0 && (
                    <View style={styles.subSection}>
                      <Text style={styles.subSectionTitle}>ADHD Symptoms</Text>
                      {record.adhdSymptoms.map((symptom, idx) => (
                        <Text key={idx} style={styles.listItem} wrap={false}>
                          {idx + 1}. {safeString(symptom)}
                        </Text>
                      ))}
                    </View>
                  )}
                  {hasValue(record.autismRedFlags) && record.autismRedFlags.length > 0 && (
                    <View style={styles.subSection}>
                      <Text style={styles.subSectionTitle}>Autism Red Flags</Text>
                      {record.autismRedFlags.map((flag, idx) => (
                        <Text key={idx} style={styles.listItem} wrap={false}>
                          {idx + 1}. {safeString(flag)}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Clinical Findings */}
              {hasValue(record.findings) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Clinical Findings</Text>
                  <Text style={styles.fieldValue}>{safeString(record.findings)}</Text>
                </View>
              )}

              {/* Assessment */}
              {hasValue(record.assessment) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Assessment</Text>
                  </View>
                  {splitBySentence(record.assessment).map((sentence, idx) => (
                    <Text key={idx} style={styles.listItem} wrap={false}>
                      {idx + 1}. {safeString(sentence)}
                    </Text>
                  ))}
                </View>
              )}

              {/* Plan */}
              {hasValue(record.plan) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  <Text style={styles.fieldValue}>{safeString(record.plan)}</Text>
                </View>
              )}

              {/* Recommendations */}
              {hasValue(record.recommendations) && record.recommendations.length > 0 && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                  </View>
                  {record.recommendations.map((rec, idx) => {
                    const text = typeof rec === 'string' ? rec : rec.recommendation || rec.text || '';
                    return (
                      <Text key={idx} style={styles.listItem} wrap={false}>
                        {idx + 1}. {safeString(text)}
                      </Text>
                    );
                  })}
                </View>
              )}

              {/* Notes */}
              {hasValue(record.notes) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                  </View>
                  {splitBySentence(record.notes).map((sentence, idx) => (
                    <Text key={idx} style={styles.listItem} wrap={false}>
                      {idx + 1}. {safeString(sentence)}
                    </Text>
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

export default BehavioralAssessmentDocumentPDFTemplate;
