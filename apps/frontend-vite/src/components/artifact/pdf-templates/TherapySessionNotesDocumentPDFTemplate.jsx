/**
 * TherapySessionNotesDocumentPDFTemplate.jsx
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(s => s.length > 0);
};

const parseSubtitleItems = (items) => {
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
  statusText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
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

const TherapySessionNotesDocumentPDFTemplate = ({ document, data }) => {
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
            <Text style={styles.documentTitle}>Therapy Session Notes</Text>
          </View>
          <Text style={{ textAlign: 'center', color: '#666666', fontSize: 14 }}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader} fixed>
          <Text style={styles.documentTitle}>Therapy Session Notes</Text>
          <Text style={styles.documentSubtitle}>Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header - thick left accent */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {safeString(`Therapy Session Notes ${idx + 1}`)}
              </Text>
              <Text style={styles.recordMeta}>
                {hasValue(record.sessionDate) && `Date: ${formatDate(record.sessionDate)}`}
                {record.sessionNumber && ` | Session #${record.sessionNumber}`}
                {record.sessionType && ` | ${safeString(record.sessionType)}`}
                {record.therapist && ` | ${safeString(record.therapist)}`}
              </Text>
            </View>

            {/* Session Information */}
            {(record.sessionNumber || record.sessionType || record.therapist) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Session Information</Text>
                {record.sessionNumber && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Session Number</Text>
                    <View style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>1.</Text>
                      <Text style={styles.itemContent}>{safeString(String(record.sessionNumber))}</Text>
                    </View>
                  </View>
                )}
                {record.sessionType && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Session Type</Text>
                    <View style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>1.</Text>
                      <Text style={styles.itemContent}>{safeString(record.sessionType)}</Text>
                    </View>
                  </View>
                )}
                {record.therapist && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Therapist</Text>
                    <View style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>1.</Text>
                      <Text style={styles.itemContent}>{safeString(record.therapist)}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Presenting Issues */}
            {hasValue(record.presentingIssues) && (() => {
              const parsed = parseSubtitleItems(record.presentingIssues);
              if (parsed.length === 0) return null;
              return (
                <View style={styles.section} wrap={parsed.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Presenting Issues</Text>
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

            {/* Interventions — semicolon split per labeled item */}
            {hasValue(record.interventions) && (() => {
              const parsed = parseSubtitleItems(record.interventions);
              if (parsed.length === 0) return null;
              const totalItems = parsed.reduce((sum, item) => {
                const semiItems = item.label ? splitBySemicolon(item.content) : [item.content];
                return sum + semiItems.length;
              }, 0);
              return (
                <View style={styles.section} wrap={totalItems > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Interventions</Text>
                  {parsed.map((item, i) => {
                    const semiItems = item.label ? splitBySemicolon(item.content) : [item.content];
                    return (
                      <View key={i} style={styles.fieldBox}>
                        {item.label && <Text style={styles.fieldLabel}>{safeString(item.label)}</Text>}
                        {semiItems.map((si, sii) => (
                          <View key={sii} style={styles.numberedItem}>
                            <Text style={styles.itemNumber}>{sii + 1}.</Text>
                            <Text style={styles.itemContent}>{safeString(si)}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Client Response */}
            {hasValue(record.response) && (() => {
              const sentences = splitBySentence(record.response);
              if (sentences.length === 0) return null;
              return (
                <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Client Response</Text>
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
            })()}

            {/* Homework */}
            {hasValue(record.homework) && (() => {
              const sentences = splitBySentence(record.homework);
              if (sentences.length === 0) return null;
              return (
                <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Homework</Text>
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
            })()}

            {/* Plan for Next Session */}
            {hasValue(record.planForNext) && (() => {
              const sentences = splitBySentence(record.planForNext);
              if (sentences.length === 0) return null;
              return (
                <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Plan for Next Session</Text>
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
            })()}

            {/* Risk Assessment */}
            {hasValue(record.riskAssessment) && (() => {
              const ra = record.riskAssessment;
              const boolFields = [
                { key: 'suicidalIdeation', label: 'Suicidal Ideation' },
                { key: 'homicidalIdeation', label: 'Homicidal Ideation' },
                { key: 'selfHarmHistory', label: 'Self-Harm History' },
                { key: 'suicideAttemptHistory', label: 'Suicide Attempt History' },
              ];
              const protectiveFactors = ra.protectiveFactors || [];

              return (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Risk Assessment</Text>

                  {/* Boolean fields in fieldBoxes */}
                  {boolFields.map((field) => {
                    if (ra[field.key] === undefined) return null;
                    return (
                      <View key={field.key} style={styles.fieldBox} wrap={false}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <Text style={styles.statusText}>{ra[field.key] ? 'YES' : 'NO'}</Text>
                      </View>
                    );
                  })}

                  {/* Risk Level — semicolon split */}
                  {hasValue(ra.riskLevel) && (() => {
                    const riskItems = splitBySemicolon(ra.riskLevel);
                    return (
                      <View style={styles.fieldBox} wrap={riskItems.length > 8 ? undefined : false}>
                        <Text style={styles.fieldLabel}>Risk Level</Text>
                        {riskItems.map((ri, rii) => (
                          <View key={rii} style={styles.numberedItem}>
                            <Text style={styles.itemNumber}>{rii + 1}.</Text>
                            <Text style={styles.itemContent}>{safeString(ri)}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}

                  {/* Protective Factors */}
                  {protectiveFactors.length > 0 && (
                    <View style={styles.fieldBox} wrap={protectiveFactors.length > 8 ? undefined : false}>
                      <Text style={styles.fieldLabel}>Protective Factors</Text>
                      {protectiveFactors.map((factor, i) => (
                        <View key={i} style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{i + 1}.</Text>
                          <Text style={styles.itemContent}>{safeString(factor)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        ))}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Therapy Session Notes - Confidential Medical Document
        </Text>
      </Page>
    </Document>
  );
};

export default TherapySessionNotesDocumentPDFTemplate;
