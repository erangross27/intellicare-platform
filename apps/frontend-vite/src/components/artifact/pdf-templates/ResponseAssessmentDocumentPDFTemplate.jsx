import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Response Assessment PDF Template — March 2026
 * BLACK & WHITE ONLY - Helvetica, LETTER, 20pt title / 12pt body
 * Prop aliasing: ({ document: data })
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
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#000000',
  },
  recordCard: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 12,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldContent: {
    fontSize: 10,
    color: '#000000',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  listItem: {
    fontSize: 10,
    color: '#000000',
    paddingLeft: 8,
    marginBottom: 2,
  },
  lesionGroup: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#000000',
  },
  lesionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
});

// humanizeKey: dynamic object-key -> readable label
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isObjEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isObjEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isObjEmptyDeep);
  return false;
};

const safeString = (v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? ''));

// Recursively flatten an object into indented label/value lines (for results)
const objectLines = (value, depth = 0, label = '') => {
  const out = [];
  if (isObjEmptyDeep(value)) return out;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (Array.isArray(value)) {
      value.filter(x => !isObjEmptyDeep(x)).forEach((x) => out.push(...objectLines(x, depth, label)));
      return out;
    }
    out.push({ depth, label, value: safeString(value) });
    return out;
  }
  if (label) out.push({ depth, label, value: null });
  Object.entries(value).filter(([, v]) => !isObjEmptyDeep(v)).forEach(([k, v]) => {
    out.push(...objectLines(v, depth + (label ? 1 : 0), humanizeKey(k)));
  });
  return out;
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Split text into sentences
const splitIntoSentences = (text) => {
  if (!text) return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

// Parse plan text by labels
const parsePlanByLabels = (planText) => {
  if (!planText || typeof planText !== 'string') return [];

  const sentences = planText.split(/\.\s+/).filter(s => s.trim().length > 0);
  const groups = [];
  let currentGroup = null;

  sentences.forEach(sentence => {
    const colonIdx = sentence.indexOf(':');
    if (colonIdx > 0 && colonIdx < 50) {
      const beforeColon = sentence.substring(0, colonIdx);
      const hasParenBefore = beforeColon.includes('(');
      if (!hasParenBefore) {
        const label = beforeColon.trim();
        const content = sentence.substring(colonIdx + 1).trim();
        const fullSentence = content.endsWith('.') ? content : content + '.';
        currentGroup = { label: label, items: [fullSentence] };
        groups.push(currentGroup);
        return;
      }
    }
    const fullSentence = sentence.trim().endsWith('.') ? sentence.trim() : sentence.trim() + '.';
    if (currentGroup) {
      currentGroup.items.push(fullSentence);
    } else {
      currentGroup = { label: null, items: [fullSentence] };
      groups.push(currentGroup);
    }
  });

  return groups;
};

const ResponseAssessmentDocumentPDFTemplate = ({ document: data }) => {
  // Handle various data formats
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.response_assessment) {
    records = data.response_assessment;
  } else if (data?.documentData) {
    records = Array.isArray(data.documentData) ? data.documentData : [data.documentData];
  } else if (data) {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Response Assessment</Text>
            <Text style={styles.subtitle}>No records available</Text>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Response Assessment</Text>
          <Text style={styles.subtitle}>Generated: {formatDate(new Date())}</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            <Text style={styles.recordTitle}>Response Assessment {idx + 1}</Text>

            {/* Date and Status */}
            {(record.date || record.dateOfResponse || record.status) && (
              <View style={styles.section}>
                {(record.date || record.dateOfResponse) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>DATE</Text>
                    <Text style={styles.fieldContent}>{formatDate(record.dateOfResponse || record.date)}</Text>
                  </View>
                )}
                {record.status && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>STATUS</Text>
                    <Text style={styles.fieldContent}>{record.status}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Response Metrics */}
            {(record.criteria || record.bestResponse || record.depthOfResponse || record.durabilityOfResponse || record.progressionFreesSurvival) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Response Metrics</Text>
                {record.criteria && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>CRITERIA</Text>
                    <Text style={styles.metricValue}>{record.criteria}</Text>
                  </View>
                )}
                {record.bestResponse && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>BEST RESPONSE</Text>
                    <Text style={styles.metricValue}>{record.bestResponse}</Text>
                  </View>
                )}
                {record.depthOfResponse && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>DEPTH OF RESPONSE</Text>
                    <Text style={styles.fieldContent}>{record.depthOfResponse}</Text>
                  </View>
                )}
                {record.durabilityOfResponse && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>DURABILITY OF RESPONSE</Text>
                    <Text style={styles.fieldContent}>{record.durabilityOfResponse}</Text>
                  </View>
                )}
                {record.progressionFreesSurvival && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>PROGRESSION-FREE SURVIVAL</Text>
                    <Text style={styles.metricValue}>{record.progressionFreesSurvival}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Measurable Disease */}
            {record.measurableDisease?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Measurable Disease</Text>
                {record.measurableDisease.map((lesion, lesionIdx) => (
                  <View key={lesionIdx} style={styles.lesionGroup}>
                    <Text style={styles.lesionTitle}>Lesion {lesionIdx + 1}</Text>
                    {lesion.location && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldSubtitle}>LOCATION</Text>
                        <Text style={styles.fieldContent}>{lesion.location}</Text>
                      </View>
                    )}
                    {lesion.size && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldSubtitle}>SIZE</Text>
                        <Text style={styles.fieldContent}>{lesion.size}</Text>
                      </View>
                    )}
                    {lesion.status && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldSubtitle}>STATUS</Text>
                        <Text style={styles.fieldContent}>{lesion.status}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Results — dynamic-key object */}
            {!isObjEmptyDeep(record.results) && (() => {
              const lines = objectLines(record.results, 0, '');
              if (lines.length === 0) return null;
              return (
                <View style={styles.section} wrap={lines.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {lines.map((ln, i) => (
                    <View key={`results-${idx}-${i}`} style={[styles.fieldBlock, { flexDirection: 'row', paddingLeft: 8 + 8 * ln.depth }]}>
                      {ln.value === null ? (
                        <Text style={styles.fieldSubtitle}>{ln.label.toUpperCase()}</Text>
                      ) : (
                        <>
                          <Text style={styles.fieldSubtitle}>{ln.label ? ln.label.toUpperCase() + ': ' : ''}</Text>
                          <Text style={styles.fieldContent}>{ln.value}</Text>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Provider Information */}
            {(record.provider || record.facility) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Provider Information</Text>
                {record.provider && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>PROVIDER</Text>
                    <Text style={styles.fieldContent}>{record.provider}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>FACILITY</Text>
                    <Text style={styles.fieldContent}>{record.facility}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Clinical Findings */}
            {record.findings && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Clinical Findings</Text>
                {splitIntoSentences(record.findings).map((sentence, sentIdx) => (
                  <Text key={sentIdx} style={styles.listItem}>{sentence}</Text>
                ))}
              </View>
            )}

            {/* Clinical Assessment */}
            {record.assessment && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Clinical Assessment</Text>
                {splitIntoSentences(record.assessment).map((sentence, sentIdx) => (
                  <Text key={sentIdx} style={styles.listItem}>{sentence}</Text>
                ))}
              </View>
            )}

            {/* Treatment Plan */}
            {record.plan && (() => {
              const planGroups = parsePlanByLabels(record.plan);
              const hasLabels = planGroups.some(g => g.label);

              if (!hasLabels) {
                return (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Treatment Plan</Text>
                    {splitIntoSentences(record.plan).map((sentence, sentIdx) => (
                      <Text key={sentIdx} style={styles.listItem}>{sentence}</Text>
                    ))}
                  </View>
                );
              }

              return (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Treatment Plan</Text>
                  {planGroups.map((group, groupIdx) => (
                    <View key={groupIdx} style={styles.fieldBlock}>
                      {group.label && <Text style={styles.fieldSubtitle}>{group.label.toUpperCase()}</Text>}
                      {group.items.map((item, itemIdx) => (
                        <Text key={itemIdx} style={styles.fieldContent}>{item}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Additional Notes */}
            {record.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Notes</Text>
                {splitIntoSentences(record.notes).map((sentence, sentIdx) => (
                  <Text key={sentIdx} style={styles.listItem}>{sentence}</Text>
                ))}
              </View>
            )}

            {/* Recommendations */}
            {record.recommendations?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {record.recommendations.map((rec, recIdx) => {
                  const isString = typeof rec === 'string';
                  const recText = isString ? rec : rec.recommendation;
                  const recDate = isString ? null : rec.date;

                  return (
                    <View key={recIdx} style={styles.fieldBlock}>
                      {recDate && <Text style={styles.fieldSubtitle}>{formatDate(recDate)}</Text>}
                      <Text style={styles.fieldContent}>{recText}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ResponseAssessmentDocumentPDFTemplate;
