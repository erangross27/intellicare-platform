import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ChiefComplaintsDocumentPDFTemplate - February 2026
 *
 * PDF export for chief complaints records with medical-specific fields.
 * Follows PDF Template Standards (Feb 2026):
 * - Helvetica font, 14pt base, A4 page
 * - Pure black & white: only #000000 text on #ffffff page, no borders/background boxes
 * - Uniform styling: section values are not bold (only titles/labels are bold, across all sections)
 * - Semicolon splitting for progressionPattern, triggeringEvent, functionalImpact
 * - Primary Complaint narrative split by sentence into numbered rows
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // paddingBottom only — a bottom margin on the record wrapper makes react-pdf 4.5.1 shove the
  // whole record to the next page (empty first page).
  recordContainer: {
    paddingBottom: 8,
  },
  recordHeader: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  recordDate: {
    fontSize: 12,
    color: '#333333',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  fieldBox: {
    marginBottom: 6,
  },
  // 1pt black rule under every section title
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 3,
    marginBottom: 8,
  },
  primarySection: {
    marginBottom: 16,
  },
  emergencySection: {
    marginBottom: 16,
  },
  fieldBlock: {
    marginBottom: 6,
  },
  // 0.5pt gray rule under every field sub-label
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    paddingBottom: 3,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 8,
  },
  primaryValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
    marginBottom: 3,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 3,
    paddingLeft: 8,
    lineHeight: 1.5,
  },
  noData: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

// Safe string helper for PDF
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u03bcm/g, 'um');
  str = str.replace(/\u00b5m/g, 'um');
  str = str.replace(/\u00b0/g, ' deg');
  str = str.replace(/\u00b1/g, '+/-');
  str = str.replace(/\u2265/g, '>=');
  str = str.replace(/\u2264/g, '<=');
  str = str.replace(/\u2192/g, '->');
  str = str.replace(/\u2190/g, '<-');
  str = str.replace(/\u2022/g, '-');
  str = str.replace(/\u2014/g, '--');
  str = str.replace(/\u2013/g, '-');
  str = str.replace(/[^\x00-\x7F]/g, '');
  return str;
};

// Format date helper
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return String(dateValue);
  }
};

// Get date from record
const getRecordDate = (record) => {
  return record.createdAt || record.createdAtUTC || record.date || null;
};

// Format duration (hours to readable format)
const formatDuration = (hours) => {
  if (!hours && hours !== 0) return '';
  if (hours < 24) return `${hours} hours`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days} day${days > 1 ? 's' : ''}`;
  return `${days} day${days > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
};

// Split by semicolon for compound fields
const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
};

// Guarded comma split (mirrors the JSX): never inside parentheses; ", and …"/", or …" stays
// connected on either side; no-space commas kept ("$18,000").
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length ? result : (text.trim() ? [text.trim()] : []);
};

// Check if value exists
const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  return true;
};

// Render a simple field inside fieldBox (anti-orphan: title inside fieldBox)
const renderField = (label, value) => {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{safeString(label)}</Text>
      <Text style={styles.listItem}>1. {safeString(String(value))}</Text>
    </View>
  );
};

// Render a semicolon-split field with numbered items inside fieldBox
const renderSemicolonField = (label, text) => {
  if (!text) return null;
  const items = splitBySemicolon(text);
  if (items.length <= 1) return renderField(label, text);
  return (
    <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{safeString(label)}</Text>
      {items.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

// Render an array section with title inside first fieldBox (anti-orphan)
const renderArraySection = (title, items) => {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    </View>
  );
};

const ChiefComplaintsDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0].records) {
      rawRecords = data[0].records;
    } else if (data.length > 0 && data[0].chief_complaints) {
      rawRecords = data[0].chief_complaints;
    } else {
      rawRecords = data;
    }
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data?.chief_complaints) {
    rawRecords = data.chief_complaints;
  } else if (data) {
    rawRecords = [data];
  }

  // Clean records - remove injected underscore-prefixed fields
  const records = rawRecords.map(record => {
    if (!record || typeof record !== 'object') return record;
    const cleanRecord = {};
    for (const key of Object.keys(record)) {
      if (!key.startsWith('_')) {
        cleanRecord[key] = record[key];
      }
    }
    return cleanRecord;
  });

  // Safety check for empty records
  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Chief Complaints</Text>
          </View>
          <Text style={styles.noData}>No chief complaints records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Chief Complaints</Text>
        </View>

        {records.map((record, idx) => {
          const hasSymptomDetails = hasValue(record.symptomOnsetDateTime) || hasValue(record.symptomDurationHours) || hasValue(record.symptomSeverity) ||
                                    hasValue(record.progressionPattern) || hasValue(record.triggeringEvent);
          const hasPainAssessment = hasValue(record.painScaleScore) || hasValue(record.painCharacter) ||
                                    hasValue(record.painLocation) || hasValue(record.painRadiation);
          const hasHistory = hasValue(record.previousEpisodes) || hasValue(record.workRelated) ||
                             hasValue(record.traumaHistory);

          const recordDate = getRecordDate(record);

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  Chief Complaint {idx + 1}
                </Text>
                {hasValue(recordDate) && (
                  <Text style={styles.recordDate}>{formatDate(recordDate)}</Text>
                )}
              </View>

              {/* Primary Complaint - Highlighted */}
              {hasValue(record.primaryComplaint) && (
                <View style={styles.primarySection} wrap={false}>
                  <Text style={styles.sectionTitle}>Primary Complaint</Text>
                  {splitByComma(String(record.primaryComplaint || '')).map((s, sIdx) => (
                    <Text key={sIdx} style={styles.primaryValue}>{sIdx + 1}. {safeString(s)}</Text>
                  ))}
                </View>
              )}

              {/* Emergency Symptoms */}
              {hasValue(record.emergencySymptoms) && (
                <View style={styles.emergencySection}>
                  <View style={styles.fieldBox} wrap={record.emergencySymptoms.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Emergency Symptoms</Text>
                    {record.emergencySymptoms.map((item, itemIdx) => (
                      <Text key={itemIdx} style={styles.listItem}>
                        {itemIdx + 1}. {safeString(item)}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Secondary Complaints */}
              {renderArraySection('Secondary Complaints', record.secondaryComplaints)}

              {/* Symptom Details Section */}
              {hasSymptomDetails && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Symptom Details</Text>

                    {hasValue(record.symptomOnsetDateTime) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Symptom Onset</Text>
                        <Text style={styles.listItem}>1. {safeString(formatDate(record.symptomOnsetDateTime))}</Text>
                      </View>
                    )}

                    {hasValue(record.symptomDurationHours) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Duration</Text>
                        <Text style={styles.listItem}>1. {formatDuration(record.symptomDurationHours)}</Text>
                      </View>
                    )}

                    {hasValue(record.symptomSeverity) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Severity</Text>
                        <Text style={styles.listItem}>1. {safeString(record.symptomSeverity)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Progression — semicolon split with numbering */}
                  {renderSemicolonField('Progression', record.progressionPattern)}

                  {/* Triggering Event — semicolon split with numbering */}
                  {renderSemicolonField('Triggering Event', record.triggeringEvent)}
                </View>
              )}

              {/* Associated Symptoms */}
              {renderArraySection('Associated Symptoms', record.associatedSymptoms)}

              {/* Pain Assessment Section */}
              {hasPainAssessment && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Pain Assessment</Text>

                    {hasValue(record.painScaleScore) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Pain Scale</Text>
                        <Text style={styles.listItem}>1. {record.painScaleScore}/10</Text>
                      </View>
                    )}

                    {hasValue(record.painCharacter) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Character</Text>
                        <Text style={styles.listItem}>1. {safeString(record.painCharacter)}</Text>
                      </View>
                    )}

                    {hasValue(record.painLocation) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Location</Text>
                        <Text style={styles.listItem}>1. {safeString(record.painLocation)}</Text>
                      </View>
                    )}

                    {hasValue(record.painRadiation) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Radiation</Text>
                        <Text style={styles.listItem}>1. {safeString(record.painRadiation)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Alleviating Factors */}
              {renderArraySection('Alleviating Factors', record.alleviatingFactors)}

              {/* Aggravating Factors */}
              {renderArraySection('Aggravating Factors', record.aggravatingFactors)}

              {/* Patient Concerns */}
              {renderArraySection('Patient Concerns', record.patientConcerns)}

              {/* Functional Impact — semicolon split with numbering */}
              {hasValue(record.functionalImpact) && (
                <View style={styles.section}>
                  {renderSemicolonField('Functional Impact', record.functionalImpact)}
                </View>
              )}

              {/* History Section */}
              {hasHistory && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>History</Text>

                    {hasValue(record.previousEpisodes) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Previous Episodes</Text>
                        <Text style={styles.listItem}>1. {record.previousEpisodes ? 'Yes' : 'No'}</Text>
                      </View>
                    )}

                    {hasValue(record.workRelated) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Work Related</Text>
                        <Text style={styles.listItem}>1. {record.workRelated ? 'Yes' : 'No'}</Text>
                      </View>
                    )}

                    {hasValue(record.traumaHistory) && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Trauma History</Text>
                        <Text style={styles.listItem}>1. {safeString(record.traumaHistory)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Recent Medication Changes */}
              {renderArraySection('Recent Medication Changes', record.recentMedicationChanges)}

              {/* Systems Review */}
              {renderArraySection('Systems Review', record.systemsReview)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default ChiefComplaintsDocumentPDFTemplate;
