import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ADHDAssessmentDocumentPDFTemplate
 * PDF export template for ADHD assessment records
 *
 * Features:
 * - Helvetica font (readable)
 * - 14pt minimum content font size
 * - wrap={false} on sections
 * - Numbers for lists
 *
 * Created: December 2025
 */

// Styles following December 2025 PDF standards - 14pt MINIMUM for body text
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  header: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  recordCard: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#000000',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    color: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    paddingBottom: 4,
  },
  fieldBlock: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#333333',
  },
  fieldValue: {
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 4,
    color: '#000000',
  },
  listItem: {
    fontSize: 14,
    paddingLeft: 12,
    marginBottom: 4,
    lineHeight: 1.5,
    color: '#000000',
  },
  contentText: {
    fontSize: 14,
    marginBottom: 6,
    paddingLeft: 8,
    lineHeight: 1.5,
    color: '#000000',
  },
  nestedGroup: {
    marginLeft: 10,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#cccccc',
    marginBottom: 4,
  },
  nestedLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#333333',
  },
});

// Format date — strip time portion
const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal.$date || dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateVal);
  }
};

// Safe string helper for Unicode
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

// Split by comma but preserve content inside parentheses
const splitByCommaIgnoreParentheses = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += char;
    } else if (char === ',' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
    } else {
      current += char;
    }
  }
  const trimmed = current.trim();
  if (trimmed) result.push(trimmed);
  return result;
};

// humanizeKey — camelCase / snake_case → Title Case (for results object)
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

// Count leaves in an object (for Rule #74 wrap gating)
const countLeaves = (v) => {
  if (isEmptyDeep(v)) return 0;
  if (isScalar(v)) return 1;
  if (Array.isArray(v)) return v.reduce((n, x) => n + countLeaves(x), 0);
  return Object.values(v).reduce((n, x) => n + countLeaves(x), 0);
};

// Recursive grayscale object renderer (results)
const renderPdfObject = (value, keyPrefix) => {
  if (isEmptyDeep(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  return entries.map(([k, v]) => {
    const nodeKey = `${keyPrefix}-${k}`;
    if (isScalar(v)) {
      return (
        <View key={nodeKey} style={styles.fieldBlock}>
          <Text style={styles.fieldSubtitle}>{humanizeKey(k)}</Text>
          <Text style={styles.fieldValue}>{safeString(fmtScalar(v))}</Text>
        </View>
      );
    }
    return (
      <View key={nodeKey} style={styles.fieldBlock}>
        <Text style={styles.nestedLabel}>{humanizeKey(k)}</Text>
        <View style={styles.nestedGroup}>{renderPdfObject(v, nodeKey)}</View>
      </View>
    );
  });
};

const ADHDAssessmentDocumentPDFTemplate = ({ document, data }) => {
  // Accept both document and data props (December 2025 pattern)
  const templateData = document || data;

  // Unwrap data
  let records = [];

  if (Array.isArray(templateData)) {
    records = templateData.flatMap(item => {
      if (item.adhd_assessment) return item.adhd_assessment;
      if (item.records) return item.records;
      return item;
    });
  } else if (templateData?.adhd_assessment) {
    records = Array.isArray(templateData.adhd_assessment) ? templateData.adhd_assessment : [templateData.adhd_assessment];
  } else if (templateData?.documentData?.adhd_assessment) {
    records = Array.isArray(templateData.documentData.adhd_assessment) ? templateData.documentData.adhd_assessment : [templateData.documentData.adhd_assessment];
  } else if (templateData?.documentData) {
    records = Array.isArray(templateData.documentData) ? templateData.documentData : [templateData.documentData];
  } else if (templateData && typeof templateData === 'object') {
    records = [templateData];
  }

  records = records.filter(r => r && Object.keys(r).length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.documentTitle}>ADHD Assessment</Text>
        </View>

        {/* Records */}
        {records.map((record, idx) => {
          const pf = record.parentForm || {};
          const tf = record.teacherForm || {};
          const sym = record.symptoms || {};

          return (
            <View key={idx} style={styles.recordCard}>
              <Text style={styles.recordTitle}>ADHD Assessment {idx + 1}</Text>

              {/* Assessment Information */}
              {(record.date || record.provider || record.facility || record.screeningTool || record.status) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment Information</Text>
                  {record.status && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Status</Text>
                      <Text style={styles.fieldValue}>{safeString(record.status)}</Text>
                    </View>
                  )}
                  {record.date && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Date</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                    </View>
                  )}
                  {record.provider && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Provider</Text>
                      <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                    </View>
                  )}
                  {record.facility && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Facility</Text>
                      <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                    </View>
                  )}
                  {record.screeningTool && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Screening Tool</Text>
                      <Text style={styles.fieldValue}>{safeString(record.screeningTool)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Parent Form Scores */}
              {(pf.inattentionScore || pf.hyperactivityScore || pf.oppositionalDefiantScore || pf.conductDisorderScore) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Parent Form Scores</Text>
                  {pf.inattentionScore && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Inattention Score</Text>
                      <Text style={styles.fieldValue}>{safeString(pf.inattentionScore)}</Text>
                    </View>
                  )}
                  {pf.hyperactivityScore && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Hyperactivity Score</Text>
                      <Text style={styles.fieldValue}>{safeString(pf.hyperactivityScore)}</Text>
                    </View>
                  )}
                  {pf.oppositionalDefiantScore && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Oppositional Defiant Score</Text>
                      <Text style={styles.fieldValue}>{safeString(pf.oppositionalDefiantScore)}</Text>
                    </View>
                  )}
                  {pf.conductDisorderScore && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Conduct Disorder Score</Text>
                      <Text style={styles.fieldValue}>{safeString(pf.conductDisorderScore)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Teacher Form */}
              {tf.classroomBehavior && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Teacher Form</Text>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Classroom Behavior</Text>
                    <Text style={styles.fieldValue}>{safeString(tf.classroomBehavior)}</Text>
                  </View>
                </View>
              )}

              {/* Symptoms */}
              {(sym.duration || sym.settings?.length > 0 || sym.onsetAge || sym.functionalImpairment?.length > 0) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Symptoms</Text>
                  {sym.duration && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Duration</Text>
                      <Text style={styles.fieldValue}>{safeString(sym.duration)}</Text>
                    </View>
                  )}
                  {sym.settings?.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Settings</Text>
                      <Text style={styles.fieldValue}>{sym.settings.join(', ')}</Text>
                    </View>
                  )}
                  {sym.onsetAge && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Onset Age</Text>
                      <Text style={styles.fieldValue}>{safeString(sym.onsetAge)}</Text>
                    </View>
                  )}
                  {sym.functionalImpairment?.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Functional Impairment</Text>
                      {sym.functionalImpairment.map((item, itemIdx) => (
                        <Text key={itemIdx} style={styles.listItem}>
                          {itemIdx + 1}. {safeString(item)}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* DSM Criteria */}
              {record.dsmCriteriaMet && (() => {
                const dsmItems = splitByCommaIgnoreParentheses(record.dsmCriteriaMet);
                return (
                  <View style={styles.section}>
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>DSM Criteria</Text>
                      {dsmItems.length > 0 && (
                        <Text style={styles.listItem}>1. {safeString(dsmItems[0])}</Text>
                      )}
                    </View>
                    {dsmItems.slice(1).map((item, itemIdx) => (
                      <Text key={itemIdx} style={styles.listItem}>
                        {itemIdx + 2}. {safeString(item)}
                      </Text>
                    ))}
                  </View>
                );
              })()}

              {/* Clinical Findings */}
              {(record.differentialDiagnosis?.length > 0 || record.comorbidities?.length > 0 || record.familyHistory?.length > 0) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Clinical Findings</Text>
                  </View>
                  {record.differentialDiagnosis?.length > 0 && (
                    <View style={styles.fieldBlock} wrap={false}>
                      <Text style={styles.fieldSubtitle}>Differential Diagnosis</Text>
                      {record.differentialDiagnosis.map((item, itemIdx) => (
                        <Text key={itemIdx} style={styles.listItem}>
                          {itemIdx + 1}. {safeString(item)}
                        </Text>
                      ))}
                    </View>
                  )}
                  {record.comorbidities?.length > 0 && (
                    <View style={styles.fieldBlock} wrap={false}>
                      <Text style={styles.fieldSubtitle}>Comorbidities</Text>
                      {record.comorbidities.map((item, itemIdx) => (
                        <Text key={itemIdx} style={styles.listItem}>
                          {itemIdx + 1}. {safeString(item)}
                        </Text>
                      ))}
                    </View>
                  )}
                  {record.familyHistory?.length > 0 && (
                    <View style={styles.fieldBlock} wrap={false}>
                      <Text style={styles.fieldSubtitle}>Family History</Text>
                      {record.familyHistory.map((item, itemIdx) => (
                        <Text key={itemIdx} style={styles.listItem}>
                          {itemIdx + 1}. {safeString(item)}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Recommendations */}
              {record.recommendations?.length > 0 && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {record.recommendations.slice(0, 1).map((item, itemIdx) => (
                      <Text key={itemIdx} style={styles.listItem}>
                        {itemIdx + 1}. {safeString(item)}
                      </Text>
                    ))}
                  </View>
                  {record.recommendations.slice(1).map((item, itemIdx) => (
                    <Text key={itemIdx + 1} style={styles.listItem}>
                      {itemIdx + 2}. {safeString(item)}
                    </Text>
                  ))}
                </View>
              )}

              {/* Findings */}
              {record.findings && (() => {
                const rows = splitByCommaIgnoreParentheses(safeString(record.findings));
                return (
                  <View style={styles.section} wrap={rows.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    <Text style={styles.contentText}>{safeString(record.findings)}</Text>
                  </View>
                );
              })()}

              {/* Results */}
              {record.results && !isEmptyDeep(record.results) && typeof record.results === 'object' && (() => {
                const leaves = countLeaves(record.results);
                return (
                  <View style={styles.section} wrap={leaves > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Results</Text>
                    {renderPdfObject(record.results, `results-${idx}`)}
                  </View>
                );
              })()}

              {/* Assessment & Plan */}
              {(record.assessment || record.plan) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment & Plan</Text>
                  {record.assessment && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Assessment</Text>
                      <Text style={styles.fieldValue}>{safeString(record.assessment)}</Text>
                    </View>
                  )}
                  {record.plan && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Plan</Text>
                      <Text style={styles.fieldValue}>{safeString(record.plan)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Notes */}
              {record.notes && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.contentText}>{safeString(record.notes)}</Text>
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default ADHDAssessmentDocumentPDFTemplate;
