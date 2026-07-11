import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Helvetica font, 20/14/12pt sizes, BLACK & WHITE only
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 4,
  },
  recordHeader: {
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  recordMeta: {
    fontSize: 10,
    color: '#333333',
    marginTop: 4,
  },
  recordContent: {
    padding: 12,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 2,
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 140,
  },
  fieldContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
  },
  nestedBox: {
    marginLeft: 12,
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#000000',
  },
  nestedHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 12,
    marginBottom: 3,
  },
  contentText: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.4,
    paddingLeft: 8,
  },
  groupBox: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#333333',
  },
  groupHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    padding: 20,
  },
});

const TransplantAssessmentDocumentPDFTemplate = ({ document: data }) => {
  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return String(dateString);
    }
  };

  // Format label helper (camelCase to Title Case)
  const formatLabel = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Flatten dynamic-key object (results) for display. Nested objects expanded one level → no [object Object].
  const flattenObject = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    const items = [];
    Object.entries(obj).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      const label = formatLabel(key);
      if (typeof value === 'boolean') {
        items.push({ label, value: value ? 'Yes' : 'No' });
      } else if (Array.isArray(value)) {
        items.push({ label, value: value.map(v => (v && typeof v === 'object') ? Object.values(v).join(' ') : String(v)).join(', ') });
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue !== null && subValue !== undefined && subValue !== '') {
            items.push({ label: `${label} - ${formatLabel(subKey)}`, value: (subValue && typeof subValue === 'object') ? Object.values(subValue).join(' ') : String(subValue) });
          }
        });
      } else {
        items.push({ label, value: String(value) });
      }
    });
    return items;
  };

  // Parse findings with Label: pattern
  const parseFindingsWithLabels = (text) => {
    if (!text || typeof text !== 'string') return [];
    const groups = [];
    const sentences = text.split(/\.\s+/).filter(s => s.trim());
    let currentGroup = null;

    sentences.forEach(sentence => {
      const colonIdx = sentence.indexOf(':');
      if (colonIdx > 0 && colonIdx < 80) {
        if (currentGroup) groups.push(currentGroup);
        const label = sentence.substring(0, colonIdx).trim();
        const content = sentence.substring(colonIdx + 1).trim();
        const items = [];
        let current = '';
        let parenDepth = 0;
        for (let i = 0; i < content.length; i++) {
          const char = content[i];
          if (char === '(') parenDepth++;
          else if (char === ')') parenDepth--;
          else if (char === ',' && parenDepth === 0) {
            if (current.trim()) items.push(current.trim());
            current = '';
            continue;
          }
          current += char;
        }
        if (current.trim()) items.push(current.trim());
        currentGroup = { label, items };
      } else {
        if (currentGroup) {
          currentGroup.items.push(sentence.trim());
        } else {
          currentGroup = { label: null, items: [sentence.trim()] };
        }
      }
    });
    if (currentGroup) groups.push(currentGroup);
    return groups;
  };

  // Split into sentences helper
  const splitIntoSentences = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/\.\s+/).filter(s => s.trim().length > 0).map(s => {
      const trimmed = s.trim();
      return trimmed.endsWith('.') ? trimmed : trimmed + '.';
    });
  };

  // Data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0].records) {
      records = data[0].records;
    } else {
      records = data;
    }
  } else if (data?.records) {
    records = data.records;
  } else if (data) {
    records = [data];
  }

  // Safety check for empty data
  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Transplant Assessment</Text>
          </View>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Transplant Assessment</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={150}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Record {idx + 1}</Text>
              {record.date && (
                <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>
              )}
            </View>

            <View style={styles.recordContent}>
              {/* Section 1: Provider Information */}
              {(record.date || record.provider || record.facility) && (
                <View style={styles.section} minPresenceAhead={80} wrap={false}>
                  <Text style={styles.sectionTitle}>Provider Information</Text>
                  {record.date && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Date:</Text>
                      <Text style={styles.fieldContent}>{String(formatDate(record.date))}</Text>
                    </View>
                  )}
                  {record.provider && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Provider:</Text>
                      <Text style={styles.fieldContent}>{String(record.provider)}</Text>
                    </View>
                  )}
                  {record.facility && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Facility:</Text>
                      <Text style={styles.fieldContent}>{String(record.facility)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Section 2: Transplant Details */}
              {(record.eligibility || record.transplantType || record.timing || record.conditioning || record.stemCellSource || record.donorSearch || record.comorbidityIndex) && (
                <View style={styles.section} minPresenceAhead={80} wrap={false}>
                  <Text style={styles.sectionTitle}>Transplant Details</Text>
                  {record.eligibility && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Eligibility:</Text>
                      <Text style={styles.fieldContent}>{String(record.eligibility)}</Text>
                    </View>
                  )}
                  {record.transplantType && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Transplant Type:</Text>
                      <Text style={styles.fieldContent}>{String(record.transplantType)}</Text>
                    </View>
                  )}
                  {record.timing && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Timing:</Text>
                      <Text style={styles.fieldContent}>{String(record.timing)}</Text>
                    </View>
                  )}
                  {record.conditioning && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Conditioning:</Text>
                      <Text style={styles.fieldContent}>{String(record.conditioning)}</Text>
                    </View>
                  )}
                  {record.stemCellSource && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Stem Cell Source:</Text>
                      <Text style={styles.fieldContent}>{String(record.stemCellSource)}</Text>
                    </View>
                  )}
                  {record.donorSearch && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Donor Search:</Text>
                      <Text style={styles.fieldContent}>{String(record.donorSearch)}</Text>
                    </View>
                  )}
                  {record.comorbidityIndex && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Comorbidity Index:</Text>
                      <Text style={styles.fieldContent}>{String(record.comorbidityIndex)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Section 3: HLA Typing */}
              {record.hlaTyping && Object.keys(record.hlaTyping).length > 0 && (
                <View style={styles.section} minPresenceAhead={80} wrap={false}>
                  <Text style={styles.sectionTitle}>HLA Typing</Text>
                  <View style={styles.nestedBox}>
                    {Object.entries(record.hlaTyping).map(([key, value], hlaIdx) => (
                      <Text key={hlaIdx} style={styles.listItem}>{hlaIdx + 1}. {formatLabel(key)}: {String(value)}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 4: Findings */}
              {record.findings && (
                <View style={styles.section} minPresenceAhead={150}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  {parseFindingsWithLabels(String(record.findings)).map((group, gIdx) => {
                    if (!group || !group.items || group.items.length === 0) return null;
                    return (
                      <View key={gIdx} style={styles.groupBox} wrap={false}>
                        {group.label && (
                          <Text style={styles.groupHeader}>{String(group.label)}</Text>
                        )}
                        {group.items.map((item, itemIdx) => {
                          const itemStr = String(item || '').trim();
                          if (!itemStr) return null;
                          return (
                            <Text key={itemIdx} style={styles.listItem}>{itemIdx + 1}. {itemStr}</Text>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Section 5: Assessment */}
              {record.assessment && (
                <View style={styles.section} minPresenceAhead={80} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  {splitIntoSentences(String(record.assessment)).map((sentence, sIdx) => (
                    <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {String(sentence)}</Text>
                  ))}
                </View>
              )}

              {/* Section 6: Plan */}
              {record.plan && (
                <View style={styles.section} minPresenceAhead={80} wrap={false}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  {splitIntoSentences(String(record.plan)).map((sentence, sIdx) => (
                    <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {String(sentence)}</Text>
                  ))}
                </View>
              )}

              {/* Section 7: Recommendations */}
              {record.recommendations && record.recommendations.length > 0 && (
                <View style={styles.section} minPresenceAhead={80} wrap={false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {record.recommendations.map((rec, rIdx) => {
                    const recText = typeof rec === 'object' ? JSON.stringify(rec) : String(rec);
                    return (
                      <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {recText}</Text>
                    );
                  })}
                </View>
              )}

              {/* Section 8: Notes & Status */}
              {(record.notes || record.status) && (
                <View style={styles.section} minPresenceAhead={80} wrap={false}>
                  <Text style={styles.sectionTitle}>Notes & Status</Text>
                  {record.status && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Status:</Text>
                      <Text style={styles.fieldContent}>{String(record.status)}</Text>
                    </View>
                  )}
                  {record.notes && splitIntoSentences(String(record.notes)).map((sentence, sIdx) => (
                    <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {String(sentence)}</Text>
                  ))}
                </View>
              )}

              {/* Section 9: Results (dynamic-key object) */}
              {record.results && typeof record.results === 'object' && !Array.isArray(record.results) && flattenObject(record.results).length > 0 && (() => {
                const resultItems = flattenObject(record.results);
                return (
                  <View style={styles.section} minPresenceAhead={80} wrap={resultItems.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Results</Text>
                    <View style={styles.nestedBox}>
                      {resultItems.map((item, rIdx) => (
                        <View key={rIdx}>
                          <Text style={styles.nestedHeader}>{String(item.label)}</Text>
                          <Text style={styles.listItem}>{String(item.value)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TransplantAssessmentDocumentPDFTemplate;
