import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const safeString = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/μm/g, 'um')
    .replace(/°/g, 'deg')
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/•/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 13,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#000000',
    textAlign: 'center',
    borderBottom: '2pt solid #000000',
    paddingBottom: 12,
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: '1pt solid #000000',
  },
  recordHeader: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1pt solid #000000',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  recordDate: {
    fontSize: 12,
    color: '#000000',
    marginTop: 4,
  },
  recordSubtitle: {
    fontSize: 12,
    color: '#000000',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldBlock: {
    marginBottom: 10,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  fieldValue: {
    fontSize: 13,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 13,
    color: '#000000',
    marginLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  nestedSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 8,
  },
  noRecords: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const AdvanceDirectivesDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

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
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === ',' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
    const match = text.match(/^([^:]{2,40}):\s*(.+)/);
    if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
    return { isLabeled: false, label: '', value: text };
  };

  const getRecords = () => {
    if (!templateData) return [];
    let recordsArray = Array.isArray(templateData) ? templateData : [templateData];
    recordsArray = recordsArray.flatMap(record => {
      if (record?._records && Array.isArray(record._records)) return record._records;
      if (record?.records && Array.isArray(record.records) && !record.documentType && !record.dateCompleted) return record.records;
      if (record?.advance_directives && Array.isArray(record.advance_directives)) return record.advance_directives;
      return record;
    });
    return recordsArray.filter(record =>
      record && (record.documentType || record.dateCompleted || record.healthcareProxy || record.cprPreference)
    );
  };

  const records = getRecords();

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    return true;
  };

  const renderField = (label, value) => {
    if (!hasValue(value)) return null;
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        <Text style={styles.fieldValue}>{safeString(String(value))}</Text>
      </View>
    );
  };

  const renderSentenceField = (label, value) => {
    if (!hasValue(value)) return null;
    const sentences = splitBySentence(value);
    if (sentences.length <= 1 && splitByComma(String(value)).length < 2) {
      return renderField(label, value);
    }
    let n = 1;
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        {sentences.map((s, sIdx) => {
          const parsed = parseLabel(s);
          const textToSplit = parsed.isLabeled ? parsed.value : s;
          const parts = splitByComma(textToSplit);
          if (parts.length >= 2) {
            return (
              <View key={sIdx}>
                {parsed.isLabeled && <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>}
                {parts.map((item, pi) => (
                  <Text key={pi} style={styles.listItem}>{n++}. {safeString(item)}</Text>
                ))}
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{n++}. {safeString(s)}</Text>;
        })}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Advance Directives</Text>

        {records.length === 0 ? (
          <Text style={styles.noRecords}>No advance directives available.</Text>
        ) : (
          records.map((record, index) => (
            <View key={record._id || index} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{safeString(`Advance Directive ${index + 1}`)}</Text>
                {record.dateCompleted && (
                  <Text style={styles.recordDate}>{formatDate(record.dateCompleted)}</Text>
                )}
                {record.documentType && (
                  <Text style={styles.recordSubtitle}>{safeString(record.documentType)}</Text>
                )}
              </View>

              {/* Document Information */}
              {(hasValue(record.documentType) || hasValue(record.dateCompleted) || hasValue(record.facility) || hasValue(record.reviewDate) || hasValue(record.documentLocation) || hasValue(record.witnessSignatures)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Document Information</Text>
                  {renderField('Document Type', record.documentType)}
                  {renderField('Date Completed', formatDate(record.dateCompleted))}
                  {renderField('Facility', record.facility)}
                  {renderField('Review Date', formatDate(record.reviewDate))}
                  {renderField('Document Location', record.documentLocation)}
                  {renderField('Witness Signatures', record.witnessSignatures)}
                </View>
              )}

              {/* Treatment Preferences */}
              {(hasValue(record.cprPreference) || hasValue(record.intubationPreference) || hasValue(record.dialysisPreference) || hasValue(record.artificialNutrition) || hasValue(record.comfortMeasures) || hasValue(record.organDonation)) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Treatment Preferences</Text>
                    {renderField('CPR Preference', record.cprPreference)}
                  </View>
                  {renderField('Intubation Preference', record.intubationPreference)}
                  {renderField('Dialysis Preference', record.dialysisPreference)}
                  {renderField('Artificial Nutrition', record.artificialNutrition)}
                  {renderSentenceField('Comfort Measures', record.comfortMeasures)}
                  {renderField('Organ Donation', record.organDonation)}
                </View>
              )}

              {/* Healthcare Proxy */}
              {(hasValue(record.healthcareProxy) || hasValue(record.alternateProxy)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Healthcare Proxy</Text>
                  {renderField('Healthcare Proxy', record.healthcareProxy)}
                  {renderField('Alternate Proxy', record.alternateProxy)}
                </View>
              )}

              {/* Specific Instructions */}
              {hasValue(record.specificInstructions) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Specific Instructions</Text>
                  </View>
                  {renderSentenceField('Instructions', record.specificInstructions)}
                </View>
              )}

              {/* Additional Notes */}
              {hasValue(record.notes) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Additional Notes</Text>
                  </View>
                  {renderSentenceField('Notes', record.notes)}
                </View>
              )}
            </View>
          ))
        )}
      </Page>
    </Document>
  );
};

export default AdvanceDirectivesDocumentPDFTemplate;
