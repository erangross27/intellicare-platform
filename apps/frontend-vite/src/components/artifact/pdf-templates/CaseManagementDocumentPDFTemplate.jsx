/**
 * CaseManagementDocumentPDFTemplate.jsx
 * December 2025 Template - Black & White, Helvetica 14pt minimum
 *
 * Sections: Report Information, Services Needed, Barriers to Care,
 *           Clinical Assessment, Recommendations, Follow-Up
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// December 2025 Standards: Black & White only, Helvetica, 14pt minimum
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
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
    textAlign: 'center',
  },
  documentTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordContainer: {
    // NO marginBottom here: on react-pdf 4.5.1 a bottom MARGIN on this wrapper makes the
    // engine move the ENTIRE record to the next page instead of splitting it between
    // sections (empty-first-page bug, verified by bisection). Padding is safe.
    paddingBottom: 8,
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  recordMeta: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 10,
  },
  fieldRow: {
    marginBottom: 8,
    paddingLeft: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 8,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 12,
  },
  itemNumber: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 24,
  },
  itemContent: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
    lineHeight: 1.4,
  },
  textBlock: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 12,
  },
  noData: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
});

// Safe string conversion - handles Unicode
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);

  // Replace problematic Unicode for Helvetica
  str = str.replace(/μ/g, 'u');
  str = str.replace(/µ/g, 'u');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/–/g, '-');
  str = str.replace(/—/g, '-');
  str = str.replace(/'/g, "'");
  str = str.replace(/'/g, "'");
  str = str.replace(/"/g, '"');
  str = str.replace(/"/g, '"');

  return str;
};

// Split by comma but protect content inside parentheses
const splitByCommaProtectParens = (text) => {
  if (!text) return [];
  const items = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
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

  return items;
};

// Split text by sentences - handles "Mr.", "Dr.", "()", etc.
const splitBySentence = (text) => {
  if (!text) return [];
  const str = safeString(text).trim();
  if (!str) return [];

  // Replace abbreviations temporarily to avoid splitting on them
  let processed = str;
  const placeholders = [];

  // Common abbreviations that end with period
  const abbreviations = [
    'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Jr.', 'Sr.', 'Prof.',
    'vs.', 'i.e.', 'e.g.', 'etc.', 'approx.', 'St.',
    'No.', 'Vol.', 'Inc.', 'Corp.', 'Ltd.', 'Co.'
  ];

  abbreviations.forEach((abbr, i) => {
    const placeholder = `__ABBR${i}__`;
    const regex = new RegExp(abbr.replace('.', '\\.'), 'g');
    if (processed.includes(abbr)) {
      processed = processed.replace(regex, placeholder);
      placeholders.push({ placeholder, original: abbr });
    }
  });

  // Protect content inside parentheses
  const parenMatches = [];
  processed = processed.replace(/\([^)]*\)/g, (match) => {
    const placeholder = `__PAREN${parenMatches.length}__`;
    parenMatches.push({ placeholder, original: match });
    return placeholder;
  });

  // Split by sentence-ending punctuation followed by space or end
  const sentences = processed.split(/(?<=[.!?])\s+/);

  // Restore placeholders in each sentence
  return sentences.map(sentence => {
    let restored = sentence;
    // Restore parentheses
    parenMatches.forEach(({ placeholder, original }) => {
      restored = restored.replace(placeholder, original);
    });
    // Restore abbreviations
    placeholders.forEach(({ placeholder, original }) => {
      restored = restored.replace(new RegExp(placeholder, 'g'), original);
    });
    return restored.trim();
  }).filter(s => s.length > 0);
};

// Parse text with embedded labels - "Label: content1, content2. Label2: content3"
const parseFindingsWithLabels = (text) => {
  if (!text || typeof text !== 'string') return [];

  const sentences = splitBySentence(text);
  const groups = [];

  sentences.forEach(sentence => {
    const colonIdx = sentence.indexOf(':');
    if (colonIdx >= 2 && colonIdx <= 40) {
      const beforeColon = sentence.substring(0, colonIdx).trim();
      const afterColon = sentence.substring(colonIdx + 1).trim();

      if (/^[A-Z]/.test(beforeColon) && !beforeColon.includes('.')) {
        const items = splitByCommaProtectParens(afterColon);
        if (items.length > 0) {
          groups.push({ label: beforeColon, items });
          return;
        }
      }
    }

    if (sentence.trim()) {
      groups.push({ label: null, items: [sentence.trim()] });
    }
  });

  return groups;
};

// Group recommendations by parent: unlabeled sentence starts a group, labeled items follow
const groupRecommendationsByParent = (groups) => {
  const superGroups = [];
  let currentSuperGroup = null;

  groups.forEach(group => {
    if (group.label === null) {
      // Plain sentence = new parent recommendation
      if (currentSuperGroup) {
        superGroups.push(currentSuperGroup);
      }
      currentSuperGroup = {
        parent: group.items[0],
        children: []
      };
    } else {
      // Labeled item = belongs to current parent
      if (currentSuperGroup) {
        currentSuperGroup.children.push(group);
      } else {
        currentSuperGroup = { parent: null, children: [] };
        currentSuperGroup.children.push(group);
      }
    }
  });

  if (currentSuperGroup) {
    superGroups.push(currentSuperGroup);
  }

  return superGroups;
};

// Format date helper
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return safeString(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return safeString(dateStr);
  }
};

const CaseManagementDocumentPDFTemplate = ({ document, data }) => {
  // December 2025 pattern: accept both props
  const templateData = document || data;

  // Unwrap data - handle various wrapper formats
  let records = [];

  try {
    if (!templateData) {
      records = [];
    } else if (Array.isArray(templateData)) {
      if (templateData.length > 0 && templateData[0]?.case_management) {
        records = templateData.flatMap(item =>
          Array.isArray(item.case_management) ? item.case_management : [item.case_management]
        ).filter(Boolean);
      } else {
        records = templateData;
      }
    } else if (templateData.case_management) {
      records = Array.isArray(templateData.case_management)
        ? templateData.case_management
        : [templateData.case_management];
    } else if (templateData.reportDate || templateData.referralStatus || templateData.services) {
      records = [templateData];
    }
  } catch (err) {
    console.error('PDF data parsing error:', err);
    records = [];
  }

  // Filter valid records
  const validRecords = records.filter(r => r && typeof r === 'object' && !Array.isArray(r));

  // Empty state
  if (validRecords.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Case Management</Text>
          </View>
          <Text style={styles.noData}>No case management data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Case Management</Text>
        </View>

        {validRecords.map((record, idx) => {
          if (!record || typeof record !== 'object') return null;

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header — small, always glued (Rule #74) */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {`Case Management ${idx + 1}`}
                </Text>
                {record.reportDate && (
                  <Text style={styles.recordMeta}>{formatDate(record.reportDate)}</Text>
                )}
              </View>

              {/* Report Information — conditional wrap gated on this section's own row count (Rule #74):
                  small sections stay glued; a big one flows instead of shoving everything to the next page */}
              {(record.reportType || record.referralStatus || record.urgency || record.coordinator) && (
                <View style={styles.section} wrap={(
                  ['reportType', 'referralStatus', 'urgency'].filter(f => record[f]).length +
                  (record.coordinator ? record.coordinator.split(';').filter(s => s.trim()).length : 0)
                ) > 8 ? true : false}>
                  <Text style={styles.sectionTitle}>Report Information</Text>
                  {record.reportType && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Report Type:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.reportType)}</Text>
                    </View>
                  )}
                  {record.referralStatus && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Status:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.referralStatus)}</Text>
                    </View>
                  )}
                  {record.urgency && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Urgency:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.urgency)}</Text>
                    </View>
                  )}
                  {record.coordinator && (() => {
                    const coordParts = record.coordinator.split(';').map(s => s.trim()).filter(Boolean);
                    return coordParts.length > 1 ? (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Coordinators:</Text>
                        {coordParts.map((part, ci) => (
                          <View key={ci} style={styles.numberedItem}>
                            <Text style={styles.itemNumber}>{ci + 1}.</Text>
                            <Text style={styles.itemContent}>{safeString(part)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Coordinator:</Text>
                        <Text style={styles.fieldValue}>{safeString(record.coordinator)}</Text>
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Services Needed */}
              {Array.isArray(record.services) && record.services.length > 0 && (
                <View style={styles.section} wrap={record.services.length > 8 ? true : false}>
                  <Text style={styles.sectionTitle}>Services Needed</Text>
                  {record.services.filter(Boolean).map((service, sIdx) => (
                    <View key={sIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{sIdx + 1}.</Text>
                      <Text style={styles.itemContent}>{safeString(service)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Barriers to Care */}
              {Array.isArray(record.barriers) && record.barriers.length > 0 && (
                <View style={styles.section} wrap={record.barriers.length > 8 ? true : false}>
                  <Text style={styles.sectionTitle}>Barriers to Care</Text>
                  {record.barriers.filter(Boolean).map((barrier, bIdx) => (
                    <View key={bIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{bIdx + 1}.</Text>
                      <Text style={styles.itemContent}>{safeString(barrier)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Clinical Indication */}
              {record.clinicalIndication && (() => {
                const indParts = record.clinicalIndication.split(';').map(s => s.trim()).filter(Boolean);
                return (
                  <View style={styles.section} wrap={indParts.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Clinical Indication</Text>
                    {indParts.map((part, pIdx) => (
                      <View key={pIdx} style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{pIdx + 1}.</Text>
                        <Text style={styles.itemContent}>{safeString(part)}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Findings - parseFindingsGroups: sentence split + subtitle detection */}
              {record.findings && (() => {
                // Parse findings into groups matching JSX parseFindingsGroups
                const text = record.findings;
                const sentences = text.split(/\.\s+/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean);
                const groups = [];
                let itemNum = 1;

                for (const sentence of sentences) {
                  const colonIdx = sentence.indexOf(':');
                  const firstSemiIdx = sentence.indexOf(';');
                  if (colonIdx > 0 && firstSemiIdx > colonIdx) {
                    // "Subtitle: item1; item2; item3" pattern
                    const subtitle = sentence.substring(0, colonIdx).trim();
                    const items = sentence.substring(colonIdx + 1).split(';').map(s => s.trim()).filter(Boolean);
                    groups.push({ type: 'subtitle-group', subtitle, items });
                  } else if (sentence.includes(';')) {
                    const items = sentence.split(';').map(s => s.trim()).filter(Boolean);
                    groups.push({ type: 'items', items });
                  } else {
                    groups.push({ type: 'text', text: sentence });
                  }
                }

                if (groups.length === 0) return null;
                const findingsRows = groups.reduce((sum, g) => sum + (g.items ? g.items.length : 1) + (g.type === 'subtitle-group' ? 1 : 0), 0);

                return (
                  <View style={styles.section} wrap={findingsRows > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    {groups.map((group, gIdx) => {
                      if (group.type === 'subtitle-group') {
                        return (
                          <View key={gIdx} style={{ marginBottom: 8, marginLeft: 8 }}>
                            <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>{safeString(group.subtitle)}:</Text>
                            {group.items.map((item, iIdx) => (
                              <View key={iIdx} style={styles.numberedItem}>
                                <Text style={styles.itemNumber}>{itemNum++}.</Text>
                                <Text style={styles.itemContent}>{safeString(item)}</Text>
                              </View>
                            ))}
                          </View>
                        );
                      } else if (group.type === 'items') {
                        return group.items.map((item, iIdx) => (
                          <View key={`${gIdx}-${iIdx}`} style={styles.numberedItem}>
                            <Text style={styles.itemNumber}>{itemNum++}.</Text>
                            <Text style={styles.itemContent}>{safeString(item)}</Text>
                          </View>
                        ));
                      } else {
                        return (
                          <View key={gIdx} style={styles.numberedItem}>
                            <Text style={styles.itemNumber}>{itemNum++}.</Text>
                            <Text style={styles.itemContent}>{safeString(group.text)}</Text>
                          </View>
                        );
                      }
                    })}
                  </View>
                );
              })()}

              {/* Recommendations - Parent-Child Grouping */}
              {record.recommendations && (() => {
                const parsedGroups = parseFindingsWithLabels(record.recommendations);
                if (parsedGroups.length === 0) return null;

                const superGroups = groupRecommendationsByParent(parsedGroups);
                let itemNum = 1;
                const recRows = superGroups.reduce((sum, sg) => sum + (sg.parent ? 1 : 0) + sg.children.reduce((s, c) => s + 1 + c.items.length, 0), 0);

                return (
                  <View style={styles.section} wrap={recRows > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {superGroups.map((sg, sgIdx) => (
                      /* no border here: a partial border spec makes react-pdf treat the View as
                         unbreakable with broken height measurement → it shoves content to a fresh
                         page (the empty-first-page bug) — Rule #74: boxes/borders don't reflow */
                      <View key={sgIdx} style={{ marginBottom: 12, paddingLeft: 6 }}>
                        {/* Parent recommendation */}
                        {sg.parent && (
                          <View style={[styles.numberedItem, { marginBottom: 6 }]}>
                            <Text style={styles.itemNumber}>{itemNum++}.</Text>
                            <Text style={[styles.itemContent, { fontFamily: 'Helvetica-Bold' }]}>{safeString(sg.parent)}</Text>
                          </View>
                        )}
                        {/* Children (labeled items) */}
                        {sg.children.map((child, cIdx) => (
                          <View key={cIdx} style={{ marginBottom: 6, marginLeft: 16 }}>
                            {child.label && (
                              <Text style={[styles.fieldLabel, { marginBottom: 2 }]}>{child.label}:</Text>
                            )}
                            {child.items.map((item, iIdx) => (
                              <View key={iIdx} style={styles.numberedItem}>
                                <Text style={styles.itemNumber}>{itemNum++}.</Text>
                                <Text style={styles.itemContent}>{safeString(item)}</Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Follow-Up — split by sentence */}
              {record.followUp && (() => {
                const sentences = splitBySentence(record.followUp);
                if (sentences.length === 0) return null;
                return (
                  <View style={styles.section} wrap={sentences.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Follow-Up</Text>
                    {sentences.map((sentence, sIdx) => (
                      <View key={sIdx} style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{sIdx + 1}.</Text>
                        <Text style={styles.itemContent}>{safeString(sentence)}</Text>
                      </View>
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

export default CaseManagementDocumentPDFTemplate;
