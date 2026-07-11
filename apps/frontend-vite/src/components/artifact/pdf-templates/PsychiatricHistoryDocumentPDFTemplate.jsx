import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PsychiatricHistoryDocumentPDFTemplate - March 2026 Complete Rebuild
// Helvetica font, LETTER size, 20pt title / 12pt body, Black and white only

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
    color: '#000000',
    backgroundColor: '#ffffff'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12
  },
  recordHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginTop: 8
  },
  section: {
    marginBottom: 16,
    paddingLeft: 8
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    fontFamily: 'Helvetica-Bold',
    padding: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#000000'
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    marginTop: 10,
    fontFamily: 'Helvetica-Bold',
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#666666'
  },
  nestedLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    marginTop: 8,
    fontFamily: 'Helvetica-Bold',
    paddingLeft: 12
  },
  fieldBlock: {
    marginBottom: 10,
    paddingLeft: 12
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold'
  },
  fieldValue: {
    fontSize: 12,
    color: '#000000',
    fontFamily: 'Helvetica',
    lineHeight: 1.5
  },
  paragraph: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.6,
    marginBottom: 6,
    fontFamily: 'Helvetica',
    paddingLeft: 12
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Helvetica',
    paddingLeft: 20
  },
  numberedItem: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 3,
    fontFamily: 'Helvetica',
    paddingLeft: 24,
    lineHeight: 1.4
  },
  nestedItem: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 3,
    fontFamily: 'Helvetica',
    paddingLeft: 24
  },
  separator: {
    marginTop: 24,
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#000000'
  },
  badge: {
    fontSize: 10,
    color: '#000000',
    fontFamily: 'Helvetica'
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 12
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Helvetica-Bold',
    width: 100
  },
  metaValue: {
    fontSize: 12,
    color: '#000000',
    fontFamily: 'Helvetica',
    flex: 1
  }
});

// Helper to safely convert any value to string (handles Unicode)
const safeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(v => safeString(v)).join(', ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
};

// Helper to format date
const formatDate = (date) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(date);
  }
};

// Helper to split text into sentences
const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [safeString(text)];
  const sentences = text.split(/\.\s+/).filter(s => s.trim().length > 0);
  return sentences.map((sentence, idx) => {
    const trimmed = sentence.trim();
    if (idx < sentences.length - 1 || text.trim().endsWith('.')) {
      return trimmed.endsWith('.') ? trimmed : trimmed + '.';
    }
    return trimmed;
  });
};

// Parse "Label: comma-separated items" pattern (matches JSX)
const parseNestedLabel = (text) => {
  if (!text || typeof text !== 'string') return { label: null, items: [text] };

  const colonIdx = text.indexOf(':');
  if (colonIdx === -1 || colonIdx > 50) {
    return { label: null, items: [text] };
  }

  const beforeColon = text.substring(0, colonIdx).trim();
  const afterColon = text.substring(colonIdx + 1).trim();

  // Split by comma, respecting parentheses
  const items = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < afterColon.length; i++) {
    const char = afterColon[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) items.push(trimmed);
      current = '';
      continue;
    }
    current += char;
  }
  const lastTrimmed = current.trim();
  if (lastTrimmed) items.push(lastTrimmed);

  if (items.length <= 1) {
    return { label: beforeColon, items: items.length ? items : [afterColon] };
  }

  return { label: beforeColon, items };
};

// Humanize a dynamic object key (snake_case / camelCase) into a Title-Case label
const humanizeKey = (key) => {
  if (key === null || key === undefined) return '';
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
};

// Recursively flatten a dynamic-key object into [{ path, label, value }] typed leaves.
// Arrays become joined readable strings. Never produces "[object Object]".
const flattenObjectLeaves = (obj, parentPath = '', parentLabel = '') => {
  const leaves = [];
  if (obj === null || obj === undefined || typeof obj !== 'object') return leaves;
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    const path = parentPath ? `${parentPath}.${k}` : k;
    const label = parentLabel ? `${parentLabel} - ${humanizeKey(k)}` : humanizeKey(k);
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v)) {
      const joined = v.map(x => (x !== null && typeof x === 'object') ? safeString(x) : String(x)).filter(s => s !== '').join(', ');
      if (joined) leaves.push({ path, label, value: joined });
    } else if (typeof v === 'object') {
      leaves.push(...flattenObjectLeaves(v, path, label));
    } else if (typeof v === 'boolean') {
      leaves.push({ path, label, value: v ? 'Yes' : 'No' });
    } else {
      leaves.push({ path, label, value: String(v) });
    }
  });
  return leaves;
};

const PsychiatricHistoryDocumentPDFTemplate = ({ document }) => {
  // Data unwrapping
  let records = [];
  if (Array.isArray(document)) {
    records = document;
  } else if (document?.psychiatric_history) {
    records = Array.isArray(document.psychiatric_history)
      ? document.psychiatric_history
      : [document.psychiatric_history];
  } else if (document && typeof document === 'object') {
    records = [document];
  }

  // Filter valid records
  const validRecords = records.filter(record =>
    record.date || record.provider || record.facility ||
    record.previousEpisodes || record.hospitalizations ||
    record.suicideAttempts || record.substanceAbuse ||
    record.previousPsychotherapy || record.familyPsychHistory ||
    record.findings || record.assessment || record.plan || record.notes ||
    record.results
  );

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Psychiatric History</Text>

        {validRecords.map((record, idx) => (
          <View key={idx}>
            {idx > 0 && <View style={styles.separator} />}

            {/* Record Header with Date */}
            <View wrap={false}>
              <Text style={styles.recordHeader}>
                Record {idx + 1} — {record.date ? formatDate(record.date) : 'No Date'}
              </Text>
            </View>

            {/* Record Information Section */}
            {(record.provider || record.facility || record.type) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Record Information</Text>
                {record.provider && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Provider:</Text>
                    <Text style={styles.metaValue}>{safeString(record.provider)}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Facility:</Text>
                    <Text style={styles.metaValue}>{safeString(record.facility)}</Text>
                  </View>
                )}
                {record.type && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Type:</Text>
                    <Text style={styles.metaValue}>{safeString(record.type)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Previous Episodes Section */}
            {record.previousEpisodes && record.previousEpisodes.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Previous Psychiatric Episodes</Text>
                </View>
                {record.previousEpisodes.map((ep, i) => (
                  <View key={i} style={styles.fieldBlock}>
                    <Text style={styles.subsectionTitle}>
                      {i + 1}. {safeString(ep.diagnosis) || `Episode ${i + 1}`}
                    </Text>
                    {ep.date && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Date:</Text>
                        <Text style={styles.metaValue}>{safeString(ep.date)}</Text>
                      </View>
                    )}
                    {ep.treatment && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Treatment:</Text>
                        <Text style={styles.metaValue}>{safeString(ep.treatment)}</Text>
                      </View>
                    )}
                    {ep.outcome && (() => {
                      const parsed = parseNestedLabel(ep.outcome);
                      if (parsed.label && parsed.items.length > 1) {
                        return (
                          <View>
                            <Text style={styles.nestedLabel}>{parsed.label}:</Text>
                            {parsed.items.map((item, itemIdx) => (
                              <Text key={itemIdx} style={styles.numberedItem}>
                                {safeString(item)}
                              </Text>
                            ))}
                          </View>
                        );
                      }
                      return (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Outcome:</Text>
                          <Text style={styles.metaValue}>{safeString(ep.outcome)}</Text>
                        </View>
                      );
                    })()}
                  </View>
                ))}
              </View>
            )}

            {/* Hospitalizations Section */}
            {record.hospitalizations && record.hospitalizations.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Hospitalizations</Text>
                </View>
                {record.hospitalizations.map((hosp, i) => {
                  // Handle both string and object hospitalizations
                  if (typeof hosp === 'string') {
                    return (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(hosp)}</Text>
                    );
                  }
                  return (
                    <View key={i} style={styles.fieldBlock}>
                      <Text style={styles.subsectionTitle}>
                        {i + 1}. {safeString(hosp.facility) || `Hospitalization ${i + 1}`}
                      </Text>
                      {hosp.date && (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Date:</Text>
                          <Text style={styles.metaValue}>{safeString(hosp.date)}</Text>
                        </View>
                      )}
                      {hosp.reason && (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Reason:</Text>
                          <Text style={styles.metaValue}>{safeString(hosp.reason)}</Text>
                        </View>
                      )}
                      {hosp.duration && (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Duration:</Text>
                          <Text style={styles.metaValue}>{safeString(hosp.duration)}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Suicide Attempts Section */}
            {record.suicideAttempts && record.suicideAttempts.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Suicide Attempts</Text>
                </View>
                {record.suicideAttempts.map((att, i) => (
                  <View key={i} style={styles.fieldBlock}>
                    <Text style={styles.subsectionTitle}>Attempt {i + 1}</Text>
                    {att.date && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Date:</Text>
                        <Text style={styles.metaValue}>{safeString(att.date)}</Text>
                      </View>
                    )}
                    {att.method && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Method:</Text>
                        <Text style={styles.metaValue}>{safeString(att.method)}</Text>
                      </View>
                    )}
                    {att.hospitalization !== undefined && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Hospitalization:</Text>
                        <Text style={styles.metaValue}>{att.hospitalization ? 'Yes' : 'No'}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Substance Abuse History Section */}
            {record.substanceAbuse && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Substance Abuse History</Text>
                </View>
                {record.substanceAbuse.status && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Status:</Text>
                    <Text style={styles.metaValue}>{safeString(record.substanceAbuse.status)}</Text>
                  </View>
                )}
                {record.substanceAbuse.substances && record.substanceAbuse.substances.length > 0 && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Substances:</Text>
                    {record.substanceAbuse.substances.map((sub, i) => (
                      <Text key={i} style={styles.numberedItem}>{safeString(sub)}</Text>
                    ))}
                  </View>
                )}
                {record.substanceAbuse.sobrietyDate && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Sobriety Date:</Text>
                    <Text style={styles.metaValue}>{safeString(record.substanceAbuse.sobrietyDate)}</Text>
                  </View>
                )}
                {record.substanceAbuse.treatment && record.substanceAbuse.treatment.length > 0 && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Treatment History:</Text>
                    {record.substanceAbuse.treatment.map((tx, i) => (
                      <Text key={i} style={styles.numberedItem}>{safeString(tx)}</Text>
                    ))}
                  </View>
                )}
                {record.substanceAbuse.withdrawalSymptoms && (() => {
                  const parsed = parseNestedLabel(record.substanceAbuse.withdrawalSymptoms);
                  if (parsed.label && parsed.items.length > 1) {
                    return (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>{parsed.label}:</Text>
                        {parsed.items.map((item, itemIdx) => (
                          <Text key={itemIdx} style={styles.numberedItem}>{safeString(item)}</Text>
                        ))}
                      </View>
                    );
                  }
                  return (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Withdrawal:</Text>
                      <Text style={styles.metaValue}>{safeString(record.substanceAbuse.withdrawalSymptoms)}</Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Previous Psychotherapy Section */}
            {record.previousPsychotherapy && record.previousPsychotherapy.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Previous Psychotherapy</Text>
                </View>
                {record.previousPsychotherapy.map((therapy, i) => {
                  // Handle both string and object
                  if (typeof therapy === 'string') {
                    return (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(therapy)}</Text>
                    );
                  }
                  return (
                    <View key={i} style={styles.fieldBlock}>
                      <Text style={styles.subsectionTitle}>
                        {i + 1}. {safeString(therapy.type) || `Therapy ${i + 1}`}
                      </Text>
                      {therapy.date && (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Date:</Text>
                          <Text style={styles.metaValue}>{safeString(therapy.date)}</Text>
                        </View>
                      )}
                      {therapy.duration && (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Duration:</Text>
                          <Text style={styles.metaValue}>{safeString(therapy.duration)}</Text>
                        </View>
                      )}
                      {therapy.outcome && (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Outcome:</Text>
                          <Text style={styles.metaValue}>{safeString(therapy.outcome)}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Family Psychiatric History Section */}
            {record.familyPsychHistory && record.familyPsychHistory.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Family Psychiatric History</Text>
                </View>
                {record.familyPsychHistory.map((fam, i) => (
                  <View key={i} style={styles.fieldBlock}>
                    <Text style={styles.subsectionTitle}>
                      {i + 1}. {safeString(fam.relative)}
                    </Text>
                    {fam.condition && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Condition:</Text>
                        <Text style={styles.metaValue}>{safeString(fam.condition)}</Text>
                      </View>
                    )}
                    {fam.treatment && (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Treatment:</Text>
                        <Text style={styles.metaValue}>{safeString(fam.treatment)}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Findings Section */}
            {record.findings && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                </View>
                {splitIntoSentences(safeString(record.findings)).map((sentence, sIdx) => (
                  <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>
                ))}
              </View>
            )}

            {/* Assessment Section - with parseNestedLabel */}
            {record.assessment && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                </View>
                {splitIntoSentences(safeString(record.assessment)).map((sentence, sIdx) => {
                  const parsed = parseNestedLabel(sentence);
                  if (parsed.label && parsed.items.length > 1) {
                    return (
                      <View key={sIdx} style={styles.fieldBlock}>
                        <Text style={styles.nestedLabel}>{parsed.label}:</Text>
                        {parsed.items.map((item, itemIdx) => (
                          <Text key={itemIdx} style={styles.numberedItem}>{safeString(item)}</Text>
                        ))}
                      </View>
                    );
                  }
                  return (
                    <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>
                  );
                })}
              </View>
            )}

            {/* Plan Section */}
            {record.plan && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                </View>
                {splitIntoSentences(safeString(record.plan)).map((sentence, sIdx) => (
                  <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>
                ))}
              </View>
            )}

            {/* Recommendations Section */}
            {record.recommendations && record.recommendations.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                </View>
                {record.recommendations.map((rec, i) => (
                  <Text key={i} style={styles.listItem}>{i + 1}. {safeString(rec)}</Text>
                ))}
              </View>
            )}

            {/* Notes Section */}
            {record.notes && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                </View>
                <Text style={styles.paragraph}>{safeString(record.notes)}</Text>
              </View>
            )}

            {/* Results Section (dynamic-key object) */}
            {(() => {
              const res = record.results;
              if (!res || typeof res !== 'object' || Array.isArray(res)) return null;
              const leaves = flattenObjectLeaves(res);
              if (leaves.length === 0) return null; // content-gated
              return (
                <View style={styles.section} wrap={leaves.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {leaves.map((leaf, lIdx) => (
                    <View key={lIdx} style={styles.metaRow}>
                      <Text style={styles.metaLabel}>{leaf.label}:</Text>
                      <Text style={styles.metaValue}>{safeString(leaf.value)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PsychiatricHistoryDocumentPDFTemplate;
