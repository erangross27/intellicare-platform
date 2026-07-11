import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * AdvanceCarePlanningDocumentPDFTemplate - BLACK & WHITE PDF Export
 * Helvetica font, 20/14/12pt hierarchy, numbers in lists
 * Accepts pdfData (array with localEdits merged)
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#333333',
  },
  recordCard: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 12,
  },
  recordTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 8,
  },
  recordMeta: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  metaItem: {
    fontSize: 10,
    color: '#333333',
    marginRight: 16,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldBlock: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 12,
    color: '#000000',
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 8,
    marginBottom: 2,
  },
  contentText: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
  },
  codeStatusDisplay: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingLeft: 8,
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateString);
  }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if ((ch === '.' || ch === ';') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
      if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) {
        current += ch;
        continue;
      }
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
    } else {
      current += ch;
    }
  }
  const trimmed = current.replace(/[.;]+$/, '').trim();
  if (trimmed) result.push(trimmed);
  return result;
};

const splitByComma = (text) => {
  if (!text) return [];
  const items = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === ',' && parenDepth === 0) {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
};

const parseLabel = (text) => {
  if (!text) return { isLabeled: false, label: null, value: text };
  const colonIdx = text.indexOf(':');
  if (colonIdx > 0 && colonIdx < 50) {
    return { isLabeled: true, label: text.substring(0, colonIdx).trim(), value: text.substring(colonIdx + 1).trim() };
  }
  return { isLabeled: false, label: null, value: text };
};

const renderSentenceField = (text) => {
  if (!text) return null;
  const sentences = splitBySentence(String(text));
  let n = 1;
  return sentences.map((sentence, sIdx) => {
    const parsed = parseLabel(sentence);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        return (
          <View key={sIdx}>
            <Text style={styles.listItem}>{parsed.label}:</Text>
            {parts.map((item, pi) => (
              <Text key={pi} style={styles.listItem}>  {n++}. {item}</Text>
            ))}
          </View>
        );
      }
    }
    const parts = splitByComma(parsed.isLabeled ? parsed.value : sentence);
    if (parts.length >= 2) {
      return (
        <View key={sIdx}>
          {parsed.isLabeled && <Text style={styles.listItem}>{parsed.label}:</Text>}
          {parts.map((item, pi) => (
            <Text key={pi} style={styles.listItem}>{parsed.isLabeled ? '  ' : ''}{n++}. {item}</Text>
          ))}
        </View>
      );
    }
    return <Text key={sIdx} style={styles.listItem}>{n++}. {sentence}</Text>;
  });
};

const AdvanceCarePlanningDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping — accepts pdfData (array)
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.advance_care_planning && Array.isArray(data.advance_care_planning)) {
    records = data.advance_care_planning;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.advance_care_planning) {
      records = docData.advance_care_planning;
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
          <Text style={styles.title}>Advance Care Planning</Text>
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {/* Records */}
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            <Text style={styles.recordTitle}>
              Advance Care Planning {idx + 1}
            </Text>

            {/* Meta */}
            <View style={styles.recordMeta}>
              {record.planningDate && (
                <Text style={styles.metaItem}>Date: {formatDate(record.planningDate)}</Text>
              )}
            </View>

            {/* Code Status */}
            {record.codeStatus && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Code Status</Text>
                  <Text style={styles.codeStatusDisplay}>{record.codeStatus}</Text>
                </View>
              </View>
            )}

            {/* Participants */}
            {record.participants?.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Participants</Text>
                  <Text style={styles.listItem}>1. {record.participants[0]}</Text>
                </View>
                {record.participants.slice(1).map((item, itemIdx) => (
                  <Text key={itemIdx} style={styles.listItem}>{itemIdx + 2}. {item}</Text>
                ))}
              </View>
            )}

            {/* Goals of Care */}
            {record.goalsOfCare && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Goals of Care</Text>
                {renderSentenceField(record.goalsOfCare)}
              </View>
            )}

            {/* Values */}
            {record.values && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Values</Text>
                {renderSentenceField(record.values)}
              </View>
            )}

            {/* Treatment Preferences */}
            {record.treatmentPreferences && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Treatment Preferences</Text>
                {renderSentenceField(record.treatmentPreferences)}
              </View>
            )}

            {/* Healthcare Agent */}
            {record.healthcareAgent && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Healthcare Agent</Text>
                  <Text style={styles.contentText}>{record.healthcareAgent}</Text>
                </View>
              </View>
            )}

            {/* Advance Directive Status */}
            {record.advanceDirectiveStatus && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Advance Directive Status</Text>
                {renderSentenceField(record.advanceDirectiveStatus)}
              </View>
            )}

            {/* Prognosis Discussion */}
            {record.prognosisDiscussion && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Prognosis Discussion</Text>
                {renderSentenceField(record.prognosisDiscussion)}
              </View>
            )}

            {/* Quality of Life */}
            {record.qualityOfLife && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quality of Life</Text>
                {renderSentenceField(record.qualityOfLife)}
              </View>
            )}

            {/* Spiritual Concerns */}
            {record.spiritualConcerns && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spiritual Concerns</Text>
                {renderSentenceField(record.spiritualConcerns)}
              </View>
            )}

            {/* Follow-Up Planned */}
            {record.followUpPlanned && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Follow-Up Planned</Text>
                {renderSentenceField(record.followUpPlanned)}
              </View>
            )}

            {/* Notes */}
            {record.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {renderSentenceField(record.notes)}
              </View>
            )}

            {/* Provider Information */}
            {(record.provider || record.facility) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Provider Information</Text>
                  {record.provider && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Provider</Text>
                      <Text style={styles.fieldValue}>{record.provider}</Text>
                    </View>
                  )}
                </View>
                {record.facility && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Facility</Text>
                    <Text style={styles.fieldValue}>{record.facility}</Text>
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

export default AdvanceCarePlanningDocumentPDFTemplate;
