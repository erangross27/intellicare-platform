/**
 * TherapyProgressNotesDocumentPDFTemplate.jsx
 * February 2026 Standard - Professional Boxed Layout
 * Black & White Only, Helvetica, fieldBox pattern
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ========== UTILITY FUNCTIONS ==========

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/–/g, '-');
  str = str.replace(/—/g, '-');
  str = str.replace(/\u2018/g, "'");
  str = str.replace(/\u2019/g, "'");
  str = str.replace(/\u201C/g, '"');
  str = str.replace(/\u201D/g, '"');
  return str;
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return safeString(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(dateVal);
  }
};

// Quote-aware sentence splitter (matches JSX splitBySentence)
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const str = safeString(text);
  const sentences = [];
  let current = '';
  let quoteDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const prev = i > 0 ? str[i - 1] : '';
    const next = i < str.length - 1 ? str[i + 1] : '';

    if (ch === "'") {
      const prevIsLetter = /[a-zA-Z]/.test(prev);
      const nextIsLetter = /[a-zA-Z]/.test(next);
      if (prevIsLetter && nextIsLetter) {
        // Apostrophe (I've, it's) — no change to quote depth
      } else if (quoteDepth > 0) {
        quoteDepth--;
      } else {
        quoteDepth++;
      }
      current += ch;
      if (quoteDepth === 0 && prev === '.' && i + 1 < str.length && /\s/.test(next)) {
        const sentence = current.trim();
        if (sentence) sentences.push(sentence);
        current = '';
        while (i + 1 < str.length && /\s/.test(str[i + 1])) i++;
      }
      continue;
    }

    if (ch === '"') {
      quoteDepth = quoteDepth > 0 ? quoteDepth - 1 : quoteDepth + 1;
    }

    current += ch;

    if (ch === '.' && quoteDepth === 0 && i + 1 < str.length && /\s/.test(next)) {
      if (!/\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)\.$/i.test(current.trimEnd())) {
        const sentence = current.replace(/\.\s*$/, '').trim();
        if (sentence) sentences.push(sentence);
        current = '';
        while (i + 1 < str.length && /\s/.test(str[i + 1])) i++;
      }
    }
  }

  const remaining = current.replace(/\.$/, '').trim();
  if (remaining) sentences.push(remaining);
  return sentences;
};

// Semicolon splitter for score/metric fields
const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
};

// Parse array "Label: detail" patterns
const parseArraySubtitleItems = (items) => {
  if (!items || !Array.isArray(items)) return [];
  return items.map(item => {
    if (typeof item !== 'string') return { label: null, content: String(item) };
    const colonIdx = item.indexOf(':');
    if (colonIdx > 0 && colonIdx < 60) {
      return {
        label: item.substring(0, colonIdx).trim(),
        content: item.substring(colonIdx + 1).trim()
      };
    }
    return { label: null, content: item };
  });
};

// ========== STYLES ==========

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    paddingBottom: 14,
  },
  documentTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  documentSubtitle: {
    fontSize: 10,
    color: '#555555',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Helvetica',
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 16,
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderLeftWidth: 5,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordMeta: {
    fontSize: 10,
    marginTop: 6,
    color: '#333333',
    fontFamily: 'Helvetica',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 10,
  },
  fieldBox: {
    borderWidth: 1,
    borderColor: '#cccccc',
    marginBottom: 6,
    padding: 8,
    paddingBottom: 6,
    backgroundColor: '#fafafa',
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#555555',
    paddingLeft: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  numberedItem: {
    flexDirection: 'row',
    paddingLeft: 10,
    marginBottom: 3,
  },
  itemNumber: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 22,
  },
  itemContent: {
    fontSize: 11,
    color: '#000000',
    flex: 1,
    lineHeight: 1.5,
  },
  fieldValue: {
    fontSize: 11,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    fontFamily: 'Helvetica',
  },
});

// ========== COMPONENT ==========

const TherapyProgressNotesDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  const unwrapData = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (input.document) return Array.isArray(input.document) ? input.document : [input.document];
    if (input.data) return Array.isArray(input.data) ? input.data : [input.data];
    return [input];
  };

  const records = unwrapData(templateData);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Therapy Progress Notes</Text>
          </View>
          <Text style={{ textAlign: 'center', color: '#666666', fontSize: 14 }}>No records available</Text>
        </Page>
      </Document>
    );
  }

  // Render a narrative text field split by sentences (quote-aware)
  const renderSentenceField = (value, title) => {
    if (!hasValue(value)) return null;
    const sentences = splitBySentence(value);
    if (sentences.length === 0) return null;

    return (
      <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sentences.map((sentence, i) => (
          <View key={i} style={styles.fieldBox}>
            <View style={styles.numberedItem}>
              <Text style={styles.itemNumber}>{i + 1}.</Text>
              <Text style={styles.itemContent}>{safeString(sentence)}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // Render a semicolon-delimited field with optional Label: Value parsing
  const renderSemicolonField = (value, title, withSubtitles = false) => {
    if (!hasValue(value)) return null;
    const items = splitBySemicolon(value);
    if (items.length === 0) return null;

    return (
      <View style={styles.section} wrap={items.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.map((item, i) => {
          if (withSubtitles) {
            const colonIdx = item.indexOf(':');
            const dashIdx = item.indexOf(' - ');
            const textBeforeColon = colonIdx > 0 ? item.substring(0, colonIdx) : '';

            // "Label - SubLabel: val, SubLabel: val" → nested sub-rows
            if (dashIdx > 0 && dashIdx < 50) {
              const mainLabel = item.substring(0, dashIdx).trim();
              const remainder = item.substring(dashIdx + 3).trim();
              const subItems = remainder.split(/,\s*/).filter(Boolean);
              return (
                <View key={i} style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>{safeString(mainLabel)}</Text>
                  {subItems.map((sub, si) => {
                    const ci = sub.indexOf(':');
                    const subLabel = ci > 0 ? sub.substring(0, ci).trim() : null;
                    const subValue = ci > 0 ? sub.substring(ci + 1).trim() : sub.trim();
                    return (
                      <View key={si}>
                        {subLabel && <Text style={styles.subLabel}>{safeString(subLabel)}</Text>}
                        <View style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{`${i + 1}.${si + 1}`}</Text>
                          <Text style={styles.itemContent}>{safeString(subValue)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            }

            // "Label: Value" → simple label + value
            if (colonIdx > 0 && colonIdx < 50) {
              return (
                <View key={i} style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>{safeString(textBeforeColon.trim())}</Text>
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{i + 1}.</Text>
                    <Text style={styles.itemContent}>{safeString(item.substring(colonIdx + 1).trim())}</Text>
                  </View>
                </View>
              );
            }
          }

          // Default: flat numbered item
          return (
            <View key={i} style={styles.fieldBox}>
              <View style={styles.numberedItem}>
                <Text style={styles.itemNumber}>{i + 1}.</Text>
                <Text style={styles.itemContent}>{safeString(item)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Render a grouped field section
  const renderFieldGroup = (fields, title) => {
    const validFields = fields.filter(([, v]) => hasValue(v));
    if (validFields.length === 0) return null;

    return (
      <View style={styles.section} wrap={validFields.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {validFields.map(([label, value], i) => (
          <View key={i} style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.fieldValue}>{safeString(value)}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader} fixed>
          <Text style={styles.documentTitle}>Therapy Progress Notes</Text>
          <Text style={styles.documentSubtitle}>Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header - thick left accent */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {safeString(`Therapy Progress Notes ${idx + 1}`)}
              </Text>
              <Text style={styles.recordMeta}>
                {hasValue(record.createdAt) && `Date: ${formatDate(record.createdAt)}`}
                {record.sessionDurationMinutes && ` | Duration: ${record.sessionDurationMinutes} minutes`}
              </Text>
            </View>

            {/* Session Information */}
            {(record.createdAt || record.sessionDurationMinutes) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Session Information</Text>
                {record.createdAt && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.createdAt)}</Text>
                  </View>
                )}
                {record.sessionDurationMinutes && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Session Duration</Text>
                    <Text style={styles.fieldValue}>{safeString(String(record.sessionDurationMinutes))} minutes</Text>
                  </View>
                )}
              </View>
            )}

            {/* Patient Subjective Report — sentence split (quote-aware) */}
            {renderSentenceField(record.patientSubjectiveReport, 'Patient Subjective Report')}

            {/* Functional Outcome Measures — semicolon split with Label: Value */}
            {renderSemicolonField(record.functionalOutcomeMeasures, 'Functional Outcome Measures', true)}

            {/* Pain Scale Assessment — semicolon split */}
            {renderSemicolonField(record.painScaleAssessment, 'Pain Scale Assessment')}

            {/* Cognitive Function Assessment — sentence split */}
            {renderSentenceField(record.cognitiveFunctionAssessment, 'Cognitive Function Assessment')}

            {/* Physical Assessments */}
            {renderFieldGroup(
              [
                ['Range of Motion', record.rangeOfMotionMeasurements],
                ['Muscle Strength', record.muscleStrengthGrading],
                ['Balance Assessment', record.balanceAssessmentScores],
                ['Gait Analysis', record.gaitAnalysisFindings],
              ],
              'Physical Assessments'
            )}

            {/* Additional Assessments */}
            {renderFieldGroup(
              [
                ['Activities of Daily Living', record.activitiesOfDailyLivingStatus],
                ['Speech & Language', record.speechLanguageEvaluation],
                ['Respiratory Function', record.respiratoryFunctionMetrics],
                ['Cardiovascular Response', record.cardiovascularResponse],
              ],
              'Additional Assessments'
            )}

            {/* Therapeutic Interventions */}
            {hasValue(record.therapeuticInterventionsProvided) && (() => {
              const parsed = parseArraySubtitleItems(record.therapeuticInterventionsProvided);
              if (parsed.length === 0) return null;
              return (
                <View style={styles.section} wrap={parsed.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Therapeutic Interventions</Text>
                  {parsed.map((item, i) => (
                    <View key={i} style={styles.fieldBox}>
                      {item.label && <Text style={styles.fieldLabel}>{safeString(item.label)}</Text>}
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{i + 1}.</Text>
                        <Text style={styles.itemContent}>{safeString(item.content)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Patient Compliance — sentence split */}
            {renderSentenceField(record.patientComplianceLevel, 'Patient Compliance')}

            {/* Home Exercise Program — sentence split */}
            {renderSentenceField(record.homeExerciseProgramStatus, 'Home Exercise Program')}

            {/* Assistive Device Recommendations — sentence split */}
            {renderSentenceField(record.assistiveDeviceRecommendations, 'Assistive Device Recommendations')}

            {/* Discharge Readiness — sentence split */}
            {renderSentenceField(record.dischargeReadinessIndicators, 'Discharge Readiness')}

            {/* Adverse Events — sentence split */}
            {renderSentenceField(record.adverseEventsDocumentation, 'Adverse Events')}

            {/* Family/Caregiver Education — sentence split */}
            {renderSentenceField(record.familyCaregiverEducation, 'Family/Caregiver Education')}
          </View>
        ))}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Therapy Progress Notes - Confidential Medical Document
        </Text>
      </Page>
    </Document>
  );
};

export default TherapyProgressNotesDocumentPDFTemplate;
