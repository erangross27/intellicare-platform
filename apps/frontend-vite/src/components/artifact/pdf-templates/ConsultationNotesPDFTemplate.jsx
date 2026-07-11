import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * ConsultationNotesPDFTemplate - December 2025 Black/White PDF Template
 *
 * Standards:
 * - Helvetica font (built-in, no registration needed)
 * - 14pt minimum for body text
 * - Black text on white background ONLY
 * - wrap={false} on sections based on size
 * - Component signature: { document, data }
 * - parseWithLabels for embedded label extraction
 */

// Safe string helper for Unicode sanitization
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
  str = str.replace(/"/g, '"');
  str = str.replace(/"/g, '"');
  str = str.replace(/'/g, "'");
  str = str.replace(/'/g, "'");
  str = str.replace(/—/g, '-');
  str = str.replace(/–/g, '-');

  return str;
};

// Split text by semicolon
const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [text];
  return text
    .split(/;\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
};

// Split by comma, but ignore commas inside parentheses and after titles like Mr., Dr.
const splitByCommaSmart = (text) => {
  if (!text || typeof text !== 'string') return [text];

  // Common titles that shouldn't cause splits
  const titles = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Jr.', 'Sr.'];
  let processed = text;
  const placeholders = [];

  // Temporarily replace titles with placeholders
  titles.forEach((title, i) => {
    const placeholder = `__TITLE${i}__`;
    if (processed.includes(title)) {
      placeholders.push({ placeholder, title });
      processed = processed.split(title).join(placeholder);
    }
  });

  // Split by comma, respecting parentheses
  const result = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < processed.length; i++) {
    const char = processed[i];
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

  // Restore titles
  return result.map(item => {
    let restored = item;
    placeholders.forEach(({ placeholder, title }) => {
      restored = restored.split(placeholder).join(title);
    });
    return restored;
  });
};

// Smart split: try semicolon first, if only 1 item try comma
const splitContentItems = (text) => {
  const bySemicolon = splitBySemicolon(text);
  if (bySemicolon.length > 1) return bySemicolon;
  return splitByCommaSmart(text);
};

// Parse text with embedded labels (e.g., "PRIMARY: text. MEDICAL: more text")
const parseWithLabels = (text, labelPatterns) => {
  if (!text || typeof text !== 'string') return [];

  const labelPositions = [];
  labelPatterns.forEach(label => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedLabel})\\s*`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      labelPositions.push({ label: match[1], position: match.index, endPosition: regex.lastIndex });
    }
  });

  if (labelPositions.length === 0) {
    return [{ label: null, content: text.trim() }];
  }

  labelPositions.sort((a, b) => a.position - b.position);

  const results = [];
  labelPositions.forEach((pos, idx) => {
    const nextPos = labelPositions[idx + 1];
    const contentEnd = nextPos ? nextPos.position : text.length;
    const content = text.substring(pos.endPosition, contentEnd).trim();
    if (content) {
      results.push({ label: pos.label, content });
    }
  });

  return results;
};

// Review of Systems display name mapping
const ROS_DISPLAY_NAMES = {
  general: 'General',
  cardiovascular: 'Cardiovascular',
  respiratory: 'Respiratory',
  gastrointestinal: 'Gastrointestinal',
  genitourinary: 'Genitourinary',
  musculoskeletal: 'Musculoskeletal',
  neurological: 'Neurological',
  psychiatric: 'Psychiatric',
  endocrine: 'Endocrine',
  hematologic: 'Hematologic',
  skin: 'Skin',
  eyes: 'Eyes',
  ent: 'ENT',
  constitutional: 'Constitutional'
};

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
    color: '#000000',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  recordSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 16,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 8,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  dateText: {
    fontSize: 12,
    color: '#666666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 12,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 8,
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 140,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
    lineHeight: 1.4,
  },
  textBlock: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
    marginBottom: 8,
  },
  labeledItem: {
    marginBottom: 10,
  },
  labeledItemLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  labeledItemContent: {
    fontSize: 14,
    color: '#000000',
    paddingLeft: 12,
    lineHeight: 1.4,
  },
  // Inline row: LABEL: value on same line
  inlineRow: {
    flexDirection: 'row',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  inlineLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginRight: 4,
  },
  inlineValue: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 16,
    lineHeight: 1.4,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 10,
    color: '#666666',
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 10,
    color: '#666666',
  },
});

const ConsultationNotesPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  // Unwrap data - handle multiple possible structures
  let records = [];
  if (Array.isArray(templateData)) {
    records = templateData;
  } else if (templateData?.consultation_notes && Array.isArray(templateData.consultation_notes)) {
    records = templateData.consultation_notes;
  } else if (templateData?.consultingSpecialty || templateData?.chiefComplaint) {
    records = [templateData];
  }

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Labels for parsing
  const PE_LABELS = ['VS:', 'General:', 'HEENT:', 'CV:', 'Lungs:', 'Abdomen:', 'Extremities:', 'Neuro:', 'Skin:'];
  const ASSESSMENT_LABELS = ['PRIMARY:', 'CO-OCCURRING PSYCHIATRIC:', 'MEDICAL:', 'RISK:'];
  const PLAN_LABELS = ['PHASE 1:', 'PHASE 2:', 'PHASE 3:', 'Psychiatric:', 'Pain:', 'HCV:', 'Harm reduction:', 'Psychosocial:'];

  const renderRecord = (record, idx) => {
    const displayDate = formatDate(record.date || record.createdAt);

    // Parse embedded labels
    const parsedPE = record.physicalExamination ? parseWithLabels(record.physicalExamination, PE_LABELS) : [];
    const parsedAssessment = record.assessment ? parseWithLabels(record.assessment, ASSESSMENT_LABELS) : [];
    const parsedPlan = record.plan ? parseWithLabels(record.plan, PLAN_LABELS) : [];

    // Review of Systems
    const rosEntries = record.reviewOfSystems && typeof record.reviewOfSystems === 'object'
      ? Object.entries(record.reviewOfSystems).filter(([k, v]) => v && k !== '_id')
      : [];

    return (
      <View key={record._id || idx} style={styles.recordSection}>
        {/* Record Header */}
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>Consultation {idx + 1}</Text>
          {displayDate && <Text style={styles.dateText}>{displayDate}</Text>}
        </View>

        {/* Consultation Info */}
        {(record.consultingSpecialty || record.consultingProvider || record.reasonForConsultation) && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Consultation Information</Text>
            {record.consultingSpecialty && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Specialty:</Text>
                <Text style={styles.fieldValue}>{safeString(record.consultingSpecialty)}</Text>
              </View>
            )}
            {record.consultingProvider && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Provider:</Text>
                <Text style={styles.fieldValue}>{safeString(record.consultingProvider)}</Text>
              </View>
            )}
            {record.reasonForConsultation && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Reason:</Text>
                <Text style={styles.fieldValue}>{safeString(record.reasonForConsultation)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Chief Complaint */}
        {record.chiefComplaint && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Chief Complaint</Text>
            <Text style={styles.textBlock}>"{safeString(record.chiefComplaint)}"</Text>
          </View>
        )}

        {/* History of Present Illness */}
        {record.historyOfPresentIllness && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>History of Present Illness</Text>
            </View>
            {record.historyOfPresentIllness
              .split(/(?<=[.!?])\s+/)
              .filter(s => s.trim().length > 0)
              .map((sentence, sIdx) => (
                <Text key={sIdx} style={styles.listItem}>
                  {sIdx + 1}. {safeString(sentence.trim())}
                </Text>
              ))}
          </View>
        )}

        {/* Review of Systems */}
        {rosEntries.length > 0 && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Review of Systems</Text>
            </View>
            {rosEntries.map(([system, finding], rosIdx) => (
              <View key={rosIdx} style={styles.fieldRow} wrap={false}>
                <Text style={styles.fieldLabel}>{ROS_DISPLAY_NAMES[system] || system}:</Text>
                <Text style={styles.fieldValue}>{safeString(finding)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Physical Examination */}
        {parsedPE.length > 0 && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Physical Examination</Text>
            </View>
            {parsedPE.map((item, peIdx) => (
              <View key={peIdx} style={styles.fieldRow} wrap={false}>
                {item.label && <Text style={styles.fieldLabel}>{safeString(item.label)}:</Text>}
                <Text style={styles.fieldValue}>{safeString(item.content)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Assessment */}
        {parsedAssessment.length > 0 && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Assessment</Text>
            </View>
            {parsedAssessment.map((item, aIdx) => {
              const contentItems = splitContentItems(item.content);
              return (
                <View key={aIdx} style={styles.labeledItem} wrap={false}>
                  {item.label && <Text style={styles.labeledItemLabel}>{safeString(item.label)}:</Text>}
                  {contentItems.map((contentItem, cIdx) => (
                    <Text key={cIdx} style={styles.listItem}>
                      {cIdx + 1}. {safeString(contentItem)}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Plan */}
        {parsedPlan.length > 0 && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Plan</Text>
            </View>
            {parsedPlan.map((item, pIdx) => {
              const contentItems = splitContentItems(item.content);
              return (
                <View key={pIdx} style={styles.labeledItem} wrap={false}>
                  {item.label && <Text style={styles.labeledItemLabel}>{safeString(item.label)}:</Text>}
                  {contentItems.map((contentItem, cIdx) => (
                    <Text key={cIdx} style={styles.listItem}>
                      {cIdx + 1}. {safeString(contentItem)}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Recommendations */}
        {record.recommendations && record.recommendations.length > 0 && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              {record.recommendations.slice(0, 3).map((rec, rIdx) => (
                <Text key={rIdx} style={styles.listItem}>
                  {rIdx + 1}. {safeString(typeof rec === 'string' ? rec : rec?.recommendation || rec)}
                </Text>
              ))}
            </View>
            {record.recommendations.slice(3).map((rec, rIdx) => (
              <Text key={rIdx + 3} style={styles.listItem}>
                {rIdx + 4}. {safeString(typeof rec === 'string' ? rec : rec?.recommendation || rec)}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>CONSULTATION NOTES</Text>

        {records.length === 0 ? (
          <Text style={styles.emptyText}>No consultation notes on record</Text>
        ) : (
          records.map((record, idx) => renderRecord(record, idx))
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Protected Health Information (PHI) - Handle according to HIPAA guidelines
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export default ConsultationNotesPDFTemplate;
