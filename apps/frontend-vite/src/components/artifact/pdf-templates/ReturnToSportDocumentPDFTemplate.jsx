import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ReturnToSportDocumentPDFTemplate
 *
 * PDF export template for return to sport records.
 * Uses Helvetica font, LETTER size, 20pt/12pt fonts for doctor readability.
 * March 2026 - Following complete template checklist
 */

// CRITICAL: Accept BOTH document AND data props to prevent empty PDF
const ReturnToSportDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  // Safe string conversion with Unicode sanitization
  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    let str;
    if (typeof val === 'string') str = val;
    else if (typeof val === 'object') str = JSON.stringify(val);
    else str = String(val);

    // Replace problematic Unicode characters with ASCII equivalents
    str = str.replace(/μm/g, 'um');
    str = str.replace(/µm/g, 'um');
    str = str.replace(/μ/g, 'u');
    str = str.replace(/µ/g, 'u');
    str = str.replace(/°/g, ' deg');
    str = str.replace(/±/g, '+/-');
    str = str.replace(/≥/g, '>=');
    str = str.replace(/≤/g, '<=');
    str = str.replace(/→/g, '->');
    str = str.replace(/←/g, '<-');

    return str;
  };

  // Check if value exists and is not empty
  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return true;
  };

  // Format date for display
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return String(dateValue);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (e) {
      return String(dateValue);
    }
  };

  // Split by sentence for narrative fields
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    const prepared = text
      .replace(/Dr\./g, 'Dr_DOT_')
      .replace(/Mr\./g, 'Mr_DOT_')
      .replace(/Mrs\./g, 'Mrs_DOT_')
      .replace(/Ms\./g, 'Ms_DOT_')
      .replace(/Prof\./g, 'Prof_DOT_')
      .replace(/vs\./g, 'vs_DOT_')
      .replace(/etc\./g, 'etc_DOT_');

    const sentences = prepared.split(/(?<=[.!?])\s+/).map(s =>
      s.replace(/Dr_DOT_/g, 'Dr.')
       .replace(/Mr_DOT_/g, 'Mr.')
       .replace(/Mrs_DOT_/g, 'Mrs.')
       .replace(/Ms_DOT_/g, 'Ms.')
       .replace(/Prof_DOT_/g, 'Prof.')
       .replace(/vs_DOT_/g, 'vs.')
       .replace(/etc_DOT_/g, 'etc.')
       .trim()
    ).filter(s => s.length > 0);

    return sentences;
  };

  // Humanize an object key for display
  const humanizeKey = (key) => {
    if (key === null || key === undefined || key === '') return '';
    const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // Deep emptiness check for nested objects
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

  // Unwrap nested data structures
  let records = templateData;
  if (!Array.isArray(records)) {
    records = [records];
  }

  // flatMap to unwrap nested structures
  records = records.flatMap(record => {
    if (record?._records && Array.isArray(record._records)) {
      return record._records;
    }
    if (record?.records && Array.isArray(record.records) && !record.date && !record.sport) {
      return record.records;
    }
    if (record?.return_to_sport && Array.isArray(record.return_to_sport)) {
      return record.return_to_sport;
    }
    return record;
  });

  // Filter valid records
  records = records.filter(record =>
    record && (record.date || record.sport || record.level || record.assessment || record.criteria || record.findings || record.results || record.recommendations)
  );

  // PDF Styles - Helvetica LETTER 20pt/12pt
  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontFamily: 'Helvetica',
      fontSize: 12,
      backgroundColor: '#ffffff',
      color: '#000000',
    },
    documentTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      fontFamily: 'Helvetica-Bold',
      marginBottom: 20,
      textAlign: 'center',
    },
    recordContainer: {
      marginBottom: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#cccccc',
    },
    recordTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      fontFamily: 'Helvetica-Bold',
      marginBottom: 8,
    },
    metaRow: {
      flexDirection: 'row',
      marginBottom: 4,
      flexWrap: 'wrap',
    },
    metaItem: {
      fontSize: 12,
      color: '#000000',
      marginRight: 20,
    },
    section: {
      marginTop: 12,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      fontFamily: 'Helvetica-Bold',
      marginBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#000000',
      paddingBottom: 4,
    },
    fieldBlock: {
      marginBottom: 8,
      paddingLeft: 8,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      fontFamily: 'Helvetica-Bold',
      marginBottom: 4,
    },
    fieldValue: {
      fontSize: 12,
      lineHeight: 1.4,
    },
    listItem: {
      fontSize: 12,
      lineHeight: 1.4,
      marginBottom: 4,
      paddingLeft: 8,
    },
    textContent: {
      fontSize: 12,
      lineHeight: 1.4,
      paddingLeft: 8,
    },
    criteriaItem: {
      marginBottom: 6,
      paddingLeft: 8,
    },
    criteriaTest: {
      fontSize: 12,
      fontWeight: 'bold',
      fontFamily: 'Helvetica-Bold',
    },
    criteriaValue: {
      fontSize: 12,
      paddingLeft: 16,
    },
    objectGroup: {
      marginLeft: 10,
      paddingLeft: 8,
      borderLeftWidth: 1,
      borderLeftColor: '#999999',
      marginBottom: 4,
    },
    objectGroupLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      fontFamily: 'Helvetica-Bold',
      marginBottom: 3,
    },
    objectLeaf: {
      fontSize: 12,
      lineHeight: 1.4,
      marginBottom: 2,
    },
    objectLeafLabel: {
      fontFamily: 'Helvetica-Bold',
      fontWeight: 'bold',
    },
  });

  // Recursive grayscale object renderer (leaves: "Label: value"; nodes: indented group)
  const renderObjectNodes = (value, path) => {
    if (isEmptyDeep(value) || isScalar(value)) return null;
    return Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => {
      const keyPath = `${path}.${k}`;
      if (isScalar(v)) {
        return (
          <Text key={keyPath} style={styles.objectLeaf}>
            <Text style={styles.objectLeafLabel}>{humanizeKey(k)}: </Text>{safeString(fmtScalar(v))}
          </Text>
        );
      }
      return (
        <View key={keyPath} style={styles.objectGroup}>
          <Text style={styles.objectGroupLabel}>{humanizeKey(k)}:</Text>
          {renderObjectNodes(v, keyPath)}
        </View>
      );
    });
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Return to Sport</Text>
          <Text style={{ textAlign: 'center', marginTop: 40 }}>No return to sport data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Return to Sport</Text>

        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer}>
            {/* Record Title and Meta */}
            <View wrap={false}>
              <Text style={styles.recordTitle}>Return to Sport {recordIndex + 1}</Text>
              <View style={styles.metaRow}>
                {hasValue(record.date) && (
                  <Text style={styles.metaItem}>Date: {formatDate(record.date)}</Text>
                )}
                {hasValue(record.status) && (
                  <Text style={styles.metaItem}>Status: {safeString(record.status)}</Text>
                )}
              </View>
            </View>

            {/* Sport Information */}
            {(hasValue(record.sport) || hasValue(record.level)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sport Information</Text>
                {hasValue(record.sport) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Sport:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.sport)}</Text>
                  </View>
                )}
                {hasValue(record.level) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Level:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.level)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Return Timeline */}
            {(hasValue(record.timelineToRunning) || hasValue(record.timelineToPractice) || hasValue(record.timelineToCompetition)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Return Timeline</Text>
                {hasValue(record.timelineToRunning) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Timeline to Running:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.timelineToRunning)}</Text>
                  </View>
                )}
                {hasValue(record.timelineToPractice) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Timeline to Practice:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.timelineToPractice)}</Text>
                  </View>
                )}
                {hasValue(record.timelineToCompetition) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Timeline to Competition:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.timelineToCompetition)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Clearance Criteria */}
            {hasValue(record.criteria) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Clearance Criteria</Text>
                {record.criteria.map((criterion, idx) => (
                  <View key={idx} style={styles.criteriaItem}>
                    <Text style={styles.criteriaTest}>{idx + 1}. {safeString(criterion.test)}:</Text>
                    <Text style={styles.criteriaValue}>{safeString(criterion.targetValue)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Functional Tests */}
            {hasValue(record.functionalTests) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Functional Tests</Text>
                {record.functionalTests.map((test, idx) => (
                  <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(test)}</Text>
                ))}
              </View>
            )}

            {/* Findings */}
            {hasValue(record.findings) && (() => {
              const sentences = splitBySentence(record.findings);
              return (
                <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  {sentences.map((sentence, idx) => (
                    <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(sentence)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Assessment */}
            {hasValue(record.assessment) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                {splitBySentence(record.assessment).map((sentence, idx) => (
                  <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Results (recursive OBJECT) */}
            {hasValue(record.results) && !isEmptyDeep(record.results) && (() => {
              const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
              return (
                <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  <View style={styles.fieldBlock}>
                    {renderObjectNodes(record.results, 'results')}
                  </View>
                </View>
              );
            })()}

            {/* Plan */}
            {hasValue(record.plan) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plan</Text>
                {splitBySentence(record.plan).map((sentence, idx) => (
                  <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Notes */}
            {hasValue(record.notes) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {splitBySentence(record.notes).map((note, idx) => (
                  <Text key={idx} style={styles.listItem}>{idx + 1}. {safeString(note)}</Text>
                ))}
              </View>
            )}

            {/* Recommendations */}
            {hasValue(record.recommendations) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {(() => {
                  const grouped = record.recommendations.reduce((acc, rec) => {
                    const dateKey = typeof rec === 'object' && rec.date ? formatDate(rec.date) : 'No Date';
                    if (!acc[dateKey]) acc[dateKey] = [];
                    acc[dateKey].push(typeof rec === 'string' ? rec : safeString(rec.recommendation));
                    return acc;
                  }, {});

                  return Object.entries(grouped).map(([date, recs], gIdx) => (
                    <View key={gIdx} style={styles.fieldBlock}>
                      {date !== 'No Date' && (
                        <Text style={styles.fieldLabel}>{date}:</Text>
                      )}
                      {recs.map((recText, rIdx) => (
                        <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {safeString(recText)}</Text>
                      ))}
                    </View>
                  ));
                })()}
              </View>
            )}

            {/* Provider Information */}
            {(hasValue(record.provider) || hasValue(record.facility)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Provider Information</Text>
                {hasValue(record.provider) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Provider:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                  </View>
                )}
                {hasValue(record.facility) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Facility:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ReturnToSportDocumentPDFTemplate;
