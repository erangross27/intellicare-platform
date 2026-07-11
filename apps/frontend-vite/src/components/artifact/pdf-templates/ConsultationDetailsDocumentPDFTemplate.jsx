import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Consultation Details PDF Template - February 2026
 * Professional Black & White Format for Printing
 *
 * Standards from MCP memories:
 * - Helvetica font, A4 page, 40px padding
 * - Title 22pt, Record 16pt, Section 13pt, Label 12pt, Value 14pt
 * - Section title INSIDE fieldBox (anti-orphan pattern)
 * - wrap={false} conditional: items > 8 ? undefined : false
 * - NO borderBottom on sectionTitle
 * - NO headers or footers
 */

const safeString = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/\u03bcm/g, 'um')
    .replace(/\u00b0/g, 'deg')
    .replace(/\u00b1/g, '+/-')
    .replace(/\u00d7/g, 'x')
    .replace(/\u00f7/g, '/')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2022/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
};

// Box-free B&W canonical styles (ConsultationNotes donor, Rule #74/#75): no boxes, no grey,
// title 26 / record 19 / section 16 + 1pt black rule / label 12 + 0.5pt #999 rule / value+listItem 14.
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  documentSubtitle: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
    marginTop: 4,
  },
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
    fontSize: 13,
    color: '#000000',
    marginTop: 4,
  },
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
  fieldBox: {
    marginBottom: 12,
  },
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
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  rowLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 150,
  },
  rowValue: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    paddingLeft: 8,
    marginBottom: 3,
    lineHeight: 1.4,
  },
  noRecords: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return String(dateValue);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(date);
  } catch {
    return String(dateValue);
  }
};

const filterNulls = (arr) => (arr || []).filter(item => item != null);

// Split by sentence (parenthesis-aware, title-protected)
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

// Parse "Label: Value" pattern
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { label: '', value: text || '', isLabeled: false };
  const colonIdx = text.indexOf(':');
  if (colonIdx > 0 && colonIdx <= 40) {
    const beforeColon = text.substring(0, colonIdx).trim();
    if (/^[A-Za-z][A-Za-z\s\-/()]*$/.test(beforeColon) && beforeColon.split(/\s+/).length <= 5) {
      const afterColon = text.substring(colonIdx + 1).trim();
      if (afterColon.length > 0) {
        return { label: beforeColon, value: afterColon, isLabeled: true };
      }
    }
  }
  return { label: '', value: text, isLabeled: false };
};

// Split by comma respecting parentheses
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text];
  const parts = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === ',' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts.length > 1 ? parts : [text];
};

const ConsultationDetailsDocumentPDFTemplate = ({ document: doc, data }) => {
  const templateData = doc || data;

  // Unwrap data
  let recordsArray = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].consultation_details && Array.isArray(templateData[0].consultation_details)) {
      recordsArray = templateData[0].consultation_details;
    } else {
      recordsArray = templateData;
    }
  } else if (templateData && templateData.consultation_details && Array.isArray(templateData.consultation_details)) {
    recordsArray = templateData.consultation_details;
  } else if (templateData) {
    recordsArray = [templateData];
  }

  const validRecords = filterNulls(recordsArray);

  if (!validRecords || validRecords.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Consultation Details</Text>
          </View>
          <Text style={styles.noRecords}>No consultation details records available.</Text>
        </Page>
      </Document>
    );
  }

  // Render a sentence field — sectionTitle INSIDE fieldBox (anti-orphan)
  // Labeled sentences with ≥3 comma items are expanded into individual rows
  const renderSentenceField = (sectionTitle, text) => {
    if (!text) return null;
    const sentences = splitBySentence(text);
    if (sentences.length === 0) return null;

    // Build flat item list: expand labeled sentences with ≥3 comma parts
    const allItems = [];
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        if (parts.length >= 3) {
          parts.forEach(part => {
            allItems.push({ label: parsed.label, value: part, showLabel: false });
          });
          // Mark first item in group to show label
          allItems[allItems.length - parts.length].showLabel = true;
        } else {
          allItems.push({ label: parsed.label, value: parsed.value, showLabel: true });
        }
      } else {
        allItems.push({ label: null, value: s, showLabel: false });
      }
    });

    return (
      <View style={styles.fieldBox} wrap={allItems.length > 8 ? true : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {allItems.map((item, i) => (
          <View key={i}>
            {item.showLabel && <Text style={styles.fieldLabel}>{safeString(item.label)}</Text>}
            <Text style={styles.listItem}>{i + 1}. {safeString(item.value)}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Render an array field — sectionTitle INSIDE fieldBox (anti-orphan)
  const renderArrayField = (sectionTitle, items) => {
    const filtered = filterNulls(items || []);
    if (filtered.length === 0) return null;

    // Expand items with splitByComma + parseLabel
    const allItems = [];
    filtered.forEach(item => {
      const parsed = parseLabel(item);
      const parts = splitByComma(parsed.value);
      parts.forEach(part => {
        allItems.push({ label: parsed.isLabeled ? parsed.label : null, value: part });
      });
    });

    return (
      <View style={styles.fieldBox} wrap={allItems.length > 8 ? true : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {allItems.map((item, i) => {
          const prevLabel = i > 0 ? allItems[i - 1].label : null;
          const showLabel = item.label && item.label !== prevLabel;
          return (
            <View key={i}>
              {showLabel && <Text style={styles.fieldLabel}>{safeString(item.label)}</Text>}
              <Text style={styles.listItem}>{i + 1}. {safeString(item.value)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Render an object field (vitalSigns, physicalExamination, reviewOfSystems)
  const renderObjectField = (sectionTitle, obj) => {
    if (!obj) return null;
    // Handle string case
    if (typeof obj === 'string') return renderSentenceField(sectionTitle, obj);
    // Handle object case
    const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
    if (entries.length === 0) return null;
    return (
      <View style={styles.fieldBox} wrap={entries.length > 8 ? true : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {entries.map(([key, value], i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowLabel}>
              {safeString(key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim())}:
            </Text>
            <Text style={styles.rowValue}>{safeString(String(value))}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Render a simple text field — sectionTitle INSIDE fieldBox (anti-orphan)
  const renderTextField = (sectionTitle, text) => {
    if (!text) return null;
    return (
      <View style={styles.fieldBox} wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        <Text style={styles.fieldValue}>{safeString(text)}</Text>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Consultation Details</Text>
          <Text style={styles.documentSubtitle}>Confidential Medical Document</Text>
        </View>

        {validRecords.map((record, idx) => {
          // Gather consultation info fields
          const infoFields = [];
          if (record.consultationDate) infoFields.push({ label: 'Date', value: formatDate(record.consultationDate) });
          if (record.consultationType) infoFields.push({ label: 'Type', value: record.consultationType });
          if (record.specialtyService) infoFields.push({ label: 'Specialty', value: record.specialtyService });
          if (record.urgencyLevel) infoFields.push({ label: 'Urgency', value: record.urgencyLevel });
          if (record.consultingProvider) infoFields.push({ label: 'Consulting Provider', value: record.consultingProvider });
          if (record.consultingFacility) infoFields.push({ label: 'Facility', value: record.consultingFacility });
          if (record.referringProvider) infoFields.push({ label: 'Referring Provider', value: record.referringProvider });
          if (record.consultationDuration > 0) infoFields.push({ label: 'Duration', value: `${record.consultationDuration} minutes` });

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {safeString(`Consultation Details ${idx + 1}`)}
                </Text>
                {record.consultationDate && (
                  <Text style={styles.recordDate}>{formatDate(record.consultationDate)}</Text>
                )}
              </View>

              {/* Consultation Information — section title inside fieldBox */}
              {infoFields.length > 0 && (
                <View style={styles.fieldBox} wrap={infoFields.length > 8 ? true : false}>
                  <Text style={styles.sectionTitle}>Consultation Information</Text>
                  {infoFields.map((f, i) => (
                    <View key={i} style={styles.row}>
                      <Text style={styles.rowLabel}>{safeString(f.label)}:</Text>
                      <Text style={styles.rowValue}>{safeString(f.value)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Sentence fields */}
              {renderSentenceField('Chief Complaint', record.chiefComplaint)}
              {renderSentenceField('Consultation Reason', record.consultationReason)}
              {renderSentenceField('History of Present Illness', record.historyOfPresentIllness)}

              {/* Object fields (string or object) */}
              {renderObjectField('Vital Signs', record.vitalSigns)}
              {renderObjectField('Physical Examination', record.physicalExamination)}
              {renderObjectField('Review of Systems', record.reviewOfSystems)}

              {/* More sentence fields */}
              {renderSentenceField('Diagnostic Impression', record.diagnosticImpression)}
              {renderSentenceField('Consultation Opinion', record.consultationOpinion)}

              {/* Array fields */}
              {renderArrayField('Recommended Diagnostics', record.recommendedDiagnostics)}
              {renderArrayField('Therapeutic Recommendations', record.therapeuticRecommendations)}
              {renderArrayField('Medication Review', record.medicationReview)}
              {renderArrayField('Procedures Performed', record.proceduresPerformed)}

              {/* More sentence fields */}
              {renderSentenceField('Follow-up Instructions', record.followUpInstructions)}
              {renderSentenceField('Patient Education', record.patientEducation)}
              {renderSentenceField('Functional Capacity', record.functionalCapacity)}
              {renderSentenceField('Prognostic Indicators', record.prognosticIndicators)}

              {/* Agreement with Consultation */}
              {renderTextField('Agreement with Consultation', record.agreementWithConsultation)}

              {/* Clinical Notes — each sub-field is its own fieldBox with title */}
              {renderSentenceField('Findings', record.findings)}
              {renderSentenceField('Assessment', record.assessment)}
              {renderSentenceField('Plan', record.plan)}
              {renderSentenceField('Notes', record.notes)}

              {/* Recommendations (legacy array) */}
              {record.recommendations && record.recommendations.length > 0 && (() => {
                const recs = filterNulls(record.recommendations);
                if (recs.length === 0) return null;
                return (
                  <View style={styles.fieldBox} wrap={recs.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {recs.map((rec, rIdx) => (
                      <Text key={rIdx} style={styles.listItem}>
                        {rIdx + 1}. {safeString(typeof rec === 'object' ? (rec.recommendation || 'N/A') : rec)}
                      </Text>
                    ))}
                  </View>
                );
              })()}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default ConsultationDetailsDocumentPDFTemplate;
