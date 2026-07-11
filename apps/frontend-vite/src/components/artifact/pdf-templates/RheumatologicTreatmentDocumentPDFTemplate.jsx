import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// March 2026 Standards: Helvetica font, LETTER size, 20/12pt sizes, numbered lists, black & white
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  // Document header with border
  documentHeader: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Record container
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordHeader: {
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  // Section styling
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 8,
  },
  // Numbered item styling
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 12,
  },
  itemNumber: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 24,
  },
  itemContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
    lineHeight: 1.4,
  },
  // Label-value row
  row: {
    marginBottom: 8,
    paddingLeft: 12,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 8,
  },
  // Medication group styling
  medicationGroup: {
    marginBottom: 12,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#000000',
  },
  medicationHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
  },
  // No data
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
  // Nested group styling for Label: value pattern
  nestedGroup: {
    marginBottom: 12,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#000000',
  },
  nestedGroupHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
});

// Safe string conversion - handles arrays WITHOUT JSON.stringify brackets
const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Format date helper
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue);
  }
};

// Split text into sentences
const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  const titlePlaceholders = [
    { pattern: /\bDr\.\s/gi, placeholder: 'DR_PLACEHOLDER ', restore: 'Dr. ' },
    { pattern: /\bMr\.\s/gi, placeholder: 'MR_PLACEHOLDER ', restore: 'Mr. ' },
    { pattern: /\bMrs\.\s/gi, placeholder: 'MRS_PLACEHOLDER ', restore: 'Mrs. ' },
    { pattern: /\bMs\.\s/gi, placeholder: 'MS_PLACEHOLDER ', restore: 'Ms. ' },
    { pattern: /\bmg\.\s/gi, placeholder: 'MG_PLACEHOLDER ', restore: 'mg. ' },
  ];
  let processedText = text;
  titlePlaceholders.forEach(({ pattern, placeholder }) => {
    processedText = processedText.replace(pattern, placeholder);
  });
  const rawSentences = processedText.split(/\.\s+/).filter(s => s.trim());
  return rawSentences.map(s => {
    let restored = s;
    titlePlaceholders.forEach(({ placeholder, restore }) => {
      restored = restored.replace(new RegExp(placeholder, 'g'), restore);
    });
    return restored.trim().replace(/\.$/, '');
  }).filter(s => s.length > 0);
};

// Parse text with "Label: value" pattern into groups with nested subtitles
const parseFindingsWithLabels = (text) => {
  if (!text || typeof text !== 'string') return [];
  const groups = [];
  const titlePlaceholders = [
    { pattern: /\bDr\.\s/gi, placeholder: 'DR_PLACEHOLDER ', restore: 'Dr. ' },
    { pattern: /\bMr\.\s/gi, placeholder: 'MR_PLACEHOLDER ', restore: 'Mr. ' },
    { pattern: /\bMrs\.\s/gi, placeholder: 'MRS_PLACEHOLDER ', restore: 'Mrs. ' },
    { pattern: /\bMs\.\s/gi, placeholder: 'MS_PLACEHOLDER ', restore: 'Ms. ' },
    { pattern: /\bmg\.\s/gi, placeholder: 'MG_PLACEHOLDER ', restore: 'mg. ' },
  ];
  let processedText = text;
  titlePlaceholders.forEach(({ pattern, placeholder }) => {
    processedText = processedText.replace(pattern, placeholder);
  });
  const sentences = processedText.split(/\.\s+/).filter(s => s.trim());
  let currentGroup = null;

  sentences.forEach(sentence => {
    let restored = sentence;
    titlePlaceholders.forEach(({ placeholder, restore }) => {
      restored = restored.replace(new RegExp(placeholder, 'g'), restore);
    });
    restored = restored.trim().replace(/\.$/, '');

    const colonIdx = restored.indexOf(':');
    if (colonIdx > 0 && colonIdx < 80) {
      if (currentGroup) groups.push(currentGroup);
      const label = restored.substring(0, colonIdx).trim();
      const content = restored.substring(colonIdx + 1).trim();
      currentGroup = { label, items: content ? [content] : [] };
    } else {
      if (currentGroup) {
        currentGroup.items.push(restored);
      } else {
        currentGroup = { label: null, items: [restored] };
      }
    }
  });
  if (currentGroup) groups.push(currentGroup);
  return groups;
};

// Flatten results object
const flattenResults = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return obj.filter(Boolean).map((item, i) => ({
      label: prefix ? `${prefix} ${i + 1}` : `Item ${i + 1}`,
      value: typeof item === 'object' ? JSON.stringify(item) : String(item)
    }));
  }
  const flattened = [];
  Object.entries(obj).forEach(([key, value]) => {
    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
    const label = prefix ? `${prefix} - ${formattedKey}` : formattedKey;
    if (value === null || value === undefined) return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      flattened.push(...flattenResults(value, label));
    } else if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item, i) => {
        if (typeof item === 'object') {
          flattened.push(...flattenResults(item, `${label} ${i + 1}`));
        } else {
          flattened.push({ label: `${label} ${i + 1}`, value: String(item) });
        }
      });
    } else {
      flattened.push({ label, value: String(value) });
    }
  });
  return flattened;
};

const RheumatologicTreatmentDocumentPDFTemplate = ({ document }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.records) {
      records = document[0].records;
    } else if (document.length > 0 && document[0]?._records) {
      records = document[0]._records;
    } else if (document.length > 0 && document[0]?.rheumatologic_treatment) {
      records = document[0].rheumatologic_treatment;
    } else {
      records = document;
    }
  } else if (document?.records) {
    records = document.records;
  } else if (document?._records) {
    records = document._records;
  } else if (document?.rheumatologic_treatment) {
    records = document.rheumatologic_treatment;
  } else if (document) {
    records = [document];
  }

  const validRecords = Array.isArray(records) ? records : [];

  if (validRecords.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Rheumatologic Treatment</Text>
          </View>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Rheumatologic Treatment</Text>
        </View>

        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={80}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>
                {toSafeString(record._documentTitle || `Rheumatologic Treatment ${idx + 1}`)}
              </Text>
            </View>

            {/* Treatment Information Section */}
            {(record.date || record.type || record.provider || record.facility || record.status) && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Treatment Information</Text>
                {record.date && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>1.</Text>
                    <Text style={styles.itemContent}>Date: {formatDate(record.date)}</Text>
                  </View>
                )}
                {record.type && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{record.date ? '2.' : '1.'}</Text>
                    <Text style={styles.itemContent}>Type: {toSafeString(record.type)}</Text>
                  </View>
                )}
                {record.provider && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{[record.date, record.type].filter(Boolean).length + 1}.</Text>
                    <Text style={styles.itemContent}>Provider: {toSafeString(record.provider)}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{[record.date, record.type, record.provider].filter(Boolean).length + 1}.</Text>
                    <Text style={styles.itemContent}>Facility: {toSafeString(record.facility)}</Text>
                  </View>
                )}
                {record.status && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{[record.date, record.type, record.provider, record.facility].filter(Boolean).length + 1}.</Text>
                    <Text style={styles.itemContent}>Status: {toSafeString(record.status)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* DMARDs Section */}
            {record.dmards && Array.isArray(record.dmards) && record.dmards.length > 0 && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>DMARDs (Disease Modifying Antirheumatic Drugs)</Text>
                {record.dmards.map((d, dIdx) => (
                  <View key={dIdx} style={styles.medicationGroup}>
                    <Text style={styles.medicationHeader}>DMARD {dIdx + 1}: {toSafeString(d?.medication || 'Unknown')}</Text>
                    {d?.dose && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>1.</Text>
                        <Text style={styles.itemContent}>Dose: {toSafeString(d.dose)}</Text>
                      </View>
                    )}
                    {d?.frequency && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{d?.dose ? '2.' : '1.'}</Text>
                        <Text style={styles.itemContent}>Frequency: {toSafeString(d.frequency)}</Text>
                      </View>
                    )}
                    {d?.startDate && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{[d?.dose, d?.frequency].filter(Boolean).length + 1}.</Text>
                        <Text style={styles.itemContent}>Start Date: {formatDate(d.startDate)}</Text>
                      </View>
                    )}
                    {d?.response && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{[d?.dose, d?.frequency, d?.startDate].filter(Boolean).length + 1}.</Text>
                        <Text style={styles.itemContent}>Response: {toSafeString(d.response)}</Text>
                      </View>
                    )}
                    {d?.sideEffects && d.sideEffects.length > 0 && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{[d?.dose, d?.frequency, d?.startDate, d?.response].filter(Boolean).length + 1}.</Text>
                        <Text style={styles.itemContent}>Side Effects: {toSafeString(d.sideEffects)}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Biologics Section */}
            {record.biologics && Array.isArray(record.biologics) && record.biologics.length > 0 && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Biologics</Text>
                {record.biologics.map((b, bIdx) => (
                  <View key={bIdx} style={styles.medicationGroup}>
                    <Text style={styles.medicationHeader}>Biologic {bIdx + 1}: {toSafeString(b?.medication || 'Unknown')}</Text>
                    {b?.mechanism && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>1.</Text>
                        <Text style={styles.itemContent}>Mechanism: {toSafeString(b.mechanism)}</Text>
                      </View>
                    )}
                    {b?.dose && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{b?.mechanism ? '2.' : '1.'}</Text>
                        <Text style={styles.itemContent}>Dose: {toSafeString(b.dose)}</Text>
                      </View>
                    )}
                    {b?.frequency && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{[b?.mechanism, b?.dose].filter(Boolean).length + 1}.</Text>
                        <Text style={styles.itemContent}>Frequency: {toSafeString(b.frequency)}</Text>
                      </View>
                    )}
                    {b?.route && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{[b?.mechanism, b?.dose, b?.frequency].filter(Boolean).length + 1}.</Text>
                        <Text style={styles.itemContent}>Route: {toSafeString(b.route)}</Text>
                      </View>
                    )}
                    {b?.response && (
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{[b?.mechanism, b?.dose, b?.frequency, b?.route].filter(Boolean).length + 1}.</Text>
                        <Text style={styles.itemContent}>Response: {toSafeString(b.response)}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Corticosteroids Section */}
            {record.corticosteroids && (record.corticosteroids.current || record.corticosteroids.cumulative || (record.corticosteroids.complications && record.corticosteroids.complications.length > 0)) && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Corticosteroids</Text>
                {record.corticosteroids.current && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>1.</Text>
                    <Text style={styles.itemContent}>Current: {toSafeString(record.corticosteroids.current)}</Text>
                  </View>
                )}
                {record.corticosteroids.cumulative && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{record.corticosteroids.current ? '2.' : '1.'}</Text>
                    <Text style={styles.itemContent}>Cumulative: {toSafeString(record.corticosteroids.cumulative)}</Text>
                  </View>
                )}
                {record.corticosteroids.complications && record.corticosteroids.complications.length > 0 && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{[record.corticosteroids.current, record.corticosteroids.cumulative].filter(Boolean).length + 1}.</Text>
                    <Text style={styles.itemContent}>Complications: {toSafeString(record.corticosteroids.complications)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* NSAIDs Section */}
            {record.nsaids && Array.isArray(record.nsaids) && record.nsaids.length > 0 && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>NSAIDs (Non-Steroidal Anti-Inflammatory Drugs)</Text>
                {record.nsaids.map((n, nIdx) => (
                  <View key={nIdx} style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{nIdx + 1}.</Text>
                    <Text style={styles.itemContent}>{toSafeString(n)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Adjunct Therapies Section */}
            {record.adjunctTherapies && Array.isArray(record.adjunctTherapies) && record.adjunctTherapies.length > 0 && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Adjunct Therapies</Text>
                {record.adjunctTherapies.map((t, tIdx) => (
                  <View key={tIdx} style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{tIdx + 1}.</Text>
                    <Text style={styles.itemContent}>{toSafeString(t)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Findings Section */}
            {record.findings && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Findings</Text>
                {splitIntoSentences(record.findings).map((sentence, sIdx) => (
                  <View key={sIdx} style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{sIdx + 1}.</Text>
                    <Text style={styles.itemContent}>{toSafeString(sentence)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Assessment Section */}
            {record.assessment && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                {splitIntoSentences(record.assessment).map((sentence, sIdx) => (
                  <View key={sIdx} style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{sIdx + 1}.</Text>
                    <Text style={styles.itemContent}>{toSafeString(sentence)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Plan Section - uses parseFindingsWithLabels for nested subtitles */}
            {record.plan && (
              <View style={styles.section} minPresenceAhead={150} wrap={false}>
                <Text style={styles.sectionTitle}>Plan</Text>
                {parseFindingsWithLabels(String(record.plan)).map((group, gIdx) => (
                  <View key={gIdx} style={styles.nestedGroup}>
                    {group.label && (
                      <Text style={styles.nestedGroupHeader}>{toSafeString(group.label)}</Text>
                    )}
                    {group.items.map((item, itemIdx) => (
                      <View key={itemIdx} style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{itemIdx + 1}.</Text>
                        <Text style={styles.itemContent}>{toSafeString(item)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {/* Recommendations Section */}
            {record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {record.recommendations.map((rec, rIdx) => {
                  const recText = typeof rec === 'string' ? rec : (rec?.recommendation || '');
                  const recDate = typeof rec === 'object' && rec?.date ? ` (${formatDate(rec.date)})` : '';
                  return (
                    <View key={rIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{rIdx + 1}.</Text>
                      <Text style={styles.itemContent}>{toSafeString(recText)}{recDate}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Results Section */}
            {record.results && Object.keys(record.results).length > 0 && (() => {
              const flattenedResults = flattenResults(record.results);
              if (flattenedResults.length === 0) return null;
              return (
                <View style={styles.section} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {flattenedResults.map((item, rIdx) => (
                    <View key={rIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{rIdx + 1}.</Text>
                      <Text style={styles.itemContent}>{toSafeString(item.label)}: {toSafeString(item.value)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Notes Section */}
            {record.notes && (
              <View style={styles.section} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {splitIntoSentences(record.notes).map((sentence, sIdx) => (
                  <View key={sIdx} style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>{sIdx + 1}.</Text>
                    <Text style={styles.itemContent}>{toSafeString(sentence)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RheumatologicTreatmentDocumentPDFTemplate;
