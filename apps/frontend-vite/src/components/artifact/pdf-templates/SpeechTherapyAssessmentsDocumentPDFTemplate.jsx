import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    size: 'LETTER',
  },
  documentHeader: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#606060',
    borderBottomStyle: 'solid',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 4,
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#606060',
    borderBottomStyle: 'solid',
  },
  recordDateRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#6b6b6b',
    fontFamily: 'Helvetica',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#606060',
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    width: 150,
  },
  fieldValue: {
    fontSize: 12,
    color: '#404040',
    flex: 1,
  },
  listItem: {
    fontSize: 12,
    color: '#404040',
    marginBottom: 4,
    paddingLeft: 8,
  },
  subSection: {
    marginBottom: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#606060',
    borderLeftStyle: 'solid',
  },
  subSectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#606060',
    marginBottom: 4,
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'solid',
  },
  noDataText: {
    fontSize: 12,
    color: '#6b6b6b',
    textAlign: 'center',
    marginTop: 40,
  },
  text: {
    fontSize: 12,
    color: '#404040',
    marginBottom: 6,
    lineHeight: 1.6,
  },
});

/* Helper function to format date */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

/* Safe string conversion helper */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    if (val.$date) return formatDate(val.$date);
    return JSON.stringify(val);
  }
  return String(val);
};

/* recommendations[] items are objects { recommendation, date } → flatten to text */
const recItemText = (item) => {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    const txt = item.recommendation || item.text || item.value || '';
    const date = item.date ? ` (${item.date})` : '';
    return txt ? `${txt}${date}` : Object.values(item).filter(v => typeof v !== 'object').join(' - ');
  }
  return String(item);
};

/* Helper function to convert camelCase/snake_case to readable label */
const keyToLabel = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const SpeechTherapyAssessmentsDocumentPDFTemplate = ({ document: data }) => {
  /* Data unwrapping */
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.speech_therapy_assessments) {
        return inputData[0].speech_therapy_assessments;
      }
      return inputData;
    }
    if (inputData.speech_therapy_assessments) {
      return inputData.speech_therapy_assessments;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Speech Therapy Assessments</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  /* Render object section (dynamic key-value pairs; array-valued keys → lists) */
  const renderObjectSection = (title, obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const entries = Object.entries(obj).filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== '_id'
      && !(Array.isArray(v) && v.length === 0));
    if (entries.length === 0) return null;
    /* Rule #74: gate wrap on total row count (scalar rows + expanded array items) */
    const rowCount = entries.reduce((n, [, v]) => n + (Array.isArray(v) ? v.length : 1), 0);

    return (
      <View style={styles.section} wrap={rowCount > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {entries.map(([key, value], i) => (
            Array.isArray(value) ? (
              <View key={i} style={styles.subSection}>
                <Text style={styles.subSectionTitle}>{keyToLabel(key)}</Text>
                {value.map((item, j) => (
                  <Text key={j} style={styles.listItem}>{j + 1}. {typeof item === 'object' ? recItemText(item) : safeString(item)}</Text>
                ))}
              </View>
            ) : (
              <View key={i} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{keyToLabel(key)}:</Text>
                <Text style={styles.fieldValue}>{safeString(value)}</Text>
              </View>
            )
          ))}
        </View>
      </View>
    );
  };

  /* Render array section (items may be strings or { recommendation, date } objects) */
  const renderArraySection = (title, arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;

    return (
      <View style={styles.section} wrap={arr.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {arr.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {typeof item === 'object' ? recItemText(item) : safeString(item)}</Text>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Speech Therapy Assessments</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              {record.assessmentDate && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.assessmentDate)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>
                Speech Therapy Assessment {index + 1}
              </Text>
            </View>

            {/* Referral Diagnosis */}
            {record.referralDiagnosis && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Referral Diagnosis</Text>
                <View style={styles.sectionContent}>
                  <Text style={styles.text}>{safeString(record.referralDiagnosis)}</Text>
                </View>
              </View>
            )}

            {/* Therapist */}
            {record.therapist && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Therapist</Text>
                <View style={styles.sectionContent}>
                  <Text style={styles.text}>{safeString(record.therapist)}</Text>
                </View>
              </View>
            )}

            {/* Communication Assessment */}
            {renderObjectSection('Communication Assessment', record.communicationAssessment)}

            {/* Swallowing Assessment */}
            {renderObjectSection('Swallowing Assessment', record.swallowingAssessment)}

            {/* Cognitive Language */}
            {renderObjectSection('Cognitive Language', record.cognitiveLanguage)}

            {/* Voice Assessment */}
            {renderObjectSection('Voice Assessment', record.voiceAssessment)}

            {/* Recommendations */}
            {renderArraySection('Recommendations', record.recommendations)}

            {/* Treatment Plan (dynamic keys: frequency, duration, sessionDuration, setting, approaches, interventions, homePractice, ...) */}
            {renderObjectSection('Treatment Plan', record.treatmentPlan)}

            {/* Goals */}
            {renderArraySection('Goals', record.goals)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SpeechTherapyAssessmentsDocumentPDFTemplate;
