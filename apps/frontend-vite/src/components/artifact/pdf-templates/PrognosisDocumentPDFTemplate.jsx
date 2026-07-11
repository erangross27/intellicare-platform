/**
 * PrognosisDocumentPDFTemplate.jsx - December 2025 Complete Rebuild
 *
 * PDF Template following December 2025 standards:
 * - Helvetica font only (14pt minimum)
 * - Black and white only
 * - wrap={false} per-section based on size
 * - safeString() for Unicode handling
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1px solid #000000',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#000000',
  },
  recordMeta: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#000000',
    borderBottom: '1px solid #000000',
    paddingBottom: 4,
  },
  fieldBlock: {
    marginBottom: 8,
    marginLeft: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    marginLeft: 16,
  },
  riskItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    marginLeft: 16,
  },
  protectiveItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    marginLeft: 16,
  },
  noteGroup: {
    marginBottom: 8,
    marginLeft: 12,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
});

// Safe string helper for Unicode
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/⚠/g, '[!]');
  str = str.replace(/✓/g, '[+]');
  return str;
};

// Format date
const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) :
              dateVal.$date ? new Date(dateVal.$date) : new Date(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateVal);
  }
};

// Split by sentence
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
};

// Humanize a camelCase / PascalCase / snake_case object key into a readable label
const humanizeKey = (key) => {
  if (!key && key !== 0) return '';
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};

// True only when an object/array actually carries renderable content (Rule #74 content gating)
const hasContent = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.some(hasContent);
  if (typeof val === 'object') return Object.values(val).some(hasContent);
  return true; // numbers (incl. 0), booleans are meaningful
};

// Flatten a recommendation item (object or string) into a readable line
const flattenRecommendation = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && !Array.isArray(item)) {
    const main = item.recommendation || item.text || item.value || '';
    const date = item.date ? ` (${formatDate(item.date)})` : '';
    if (main) return `${safeString(main)}${date}`;
    // Unknown shape — join non-empty leaves
    return Object.entries(item)
      .filter(([, v]) => hasContent(v))
      .map(([k, v]) => `${humanizeKey(k)}: ${safeString(v)}`)
      .join(', ');
  }
  return safeString(item);
};

// Parse numbered items like "(1) text (2) text"
const parseNumberedItems = (text) => {
  if (!text || typeof text !== 'string') return [text];
  const numberedPattern = /\((\d+)\)\s*/g;
  const matches = [...text.matchAll(numberedPattern)];
  if (matches.length === 0) return [text];
  const parts = text.split(numberedPattern).filter(part => part && !/^\d+$/.test(part));
  return parts.map(part => part.trim().replace(/^,\s*/, '').trim()).filter(p => p);
};

// Parse notes with embedded labels - TOP-LEVEL only
const parseNotesWithLabels = (text) => {
  if (!text || typeof text !== 'string') return [];

  // TOP-LEVEL labels only
  const labelPatterns = ['Factors Favoring Success', 'Factors Against Success', 'Note', 'Important', 'Warning', 'Consider'];
  const labelPositions = [];

  labelPatterns.forEach((label) => {
    const regex = new RegExp(`${label}\\s*:`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      labelPositions.push({
        label,
        startIndex: match.index,
        colonEndIndex: match.index + match[0].length,
      });
    }
  });

  labelPositions.sort((a, b) => a.startIndex - b.startIndex);
  const groups = [];

  if (labelPositions.length > 0 && labelPositions[0].startIndex > 0) {
    const introText = text.substring(0, labelPositions[0].startIndex).trim();
    if (introText) {
      groups.push({ label: null, items: [introText] });
    }
  }

  labelPositions.forEach((pos, idx) => {
    const contentStart = pos.colonEndIndex;
    const contentEnd = idx + 1 < labelPositions.length
      ? labelPositions[idx + 1].startIndex
      : text.length;

    let content = text.substring(contentStart, contentEnd).trim();
    if (content.endsWith('.')) content = content.slice(0, -1).trim();

    const items = content.split(/\.\s*/).map(s => s.trim()).filter(s => s);
    if (items.length > 0) {
      groups.push({ label: pos.label, items });
    }
  });

  if (groups.length === 0 && text.trim()) {
    groups.push({ label: null, items: splitBySentence(text) });
  }

  return groups;
};

const PrognosisDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  // Unwrap data
  const unwrappedData = (() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        if (item?.prognosis) return Array.isArray(item.prognosis) ? item.prognosis : [item.prognosis];
        return [item];
      });
    }
    if (templateData.document) {
      return Array.isArray(templateData.document) ? templateData.document : [templateData.document];
    }
    if (templateData.data) {
      return Array.isArray(templateData.data) ? templateData.data : [templateData.data];
    }
    if (templateData.prognosis) {
      return Array.isArray(templateData.prognosis) ? templateData.prognosis : [templateData.prognosis];
    }
    return [templateData];
  })();

  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Prognosis</Text>
          <Text style={{ textAlign: 'center', color: '#666666' }}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Prognosis</Text>

        {unwrappedData.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Title */}
            <Text style={styles.recordTitle}>Prognosis {idx + 1}</Text>

            {/* Record Meta */}
            {(record.date || record.provider || record.facility) && (
              <View wrap={false}>
                <Text style={styles.recordMeta}>
                  {[
                    record.date ? `Date: ${formatDate(record.date)}` : null,
                    record.provider ? `Provider: ${safeString(record.provider)}` : null,
                    record.facility ? `Facility: ${safeString(record.facility)}` : null,
                  ].filter(Boolean).join(' | ')}
                </Text>
              </View>
            )}

            {/* Status */}
            {record.status && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Status</Text>
                <Text style={styles.listItem}>{safeString(record.status)}</Text>
              </View>
            )}

            {/* Short-Term Prognosis */}
            {record.shortTerm && (() => {
              const sentences = splitBySentence(record.shortTerm);
              if (sentences.length <= 4) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Short-Term Prognosis</Text>
                    {sentences.map((s, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Short-Term Prognosis</Text>
                    <Text style={styles.listItem}>1. {safeString(sentences[0])}</Text>
                  </View>
                  {sentences.slice(1).map((s, i) => (
                    <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Long-Term Prognosis */}
            {record.longTerm && (() => {
              const sentences = splitBySentence(record.longTerm);
              if (sentences.length <= 4) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Long-Term Prognosis</Text>
                    {sentences.map((s, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Long-Term Prognosis</Text>
                    <Text style={styles.listItem}>1. {safeString(sentences[0])}</Text>
                  </View>
                  {sentences.slice(1).map((s, i) => (
                    <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Risk Factors */}
            {record.riskFactors?.length > 0 && (() => {
              const items = record.riskFactors;
              if (items.length <= 4) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Risk Factors</Text>
                    {items.map((factor, i) => (
                      <Text key={i} style={styles.riskItem}>[!] {safeString(factor)}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Risk Factors</Text>
                    <Text style={styles.riskItem}>[!] {safeString(items[0])}</Text>
                  </View>
                  {items.slice(1).map((factor, i) => (
                    <Text key={i + 1} style={styles.riskItem}>[!] {safeString(factor)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Protective Factors */}
            {record.protectiveFactors?.length > 0 && (() => {
              const items = record.protectiveFactors;
              if (items.length <= 4) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Protective Factors</Text>
                    {items.map((factor, i) => (
                      <Text key={i} style={styles.protectiveItem}>[+] {safeString(factor)}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Protective Factors</Text>
                    <Text style={styles.protectiveItem}>[+] {safeString(items[0])}</Text>
                  </View>
                  {items.slice(1).map((factor, i) => (
                    <Text key={i + 1} style={styles.protectiveItem}>[+] {safeString(factor)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Motivation Factors */}
            {record.motivationFactors && (() => {
              const items = parseNumberedItems(record.motivationFactors);
              if (items.length <= 1) {
                const sentences = splitBySentence(record.motivationFactors);
                if (sentences.length <= 4) {
                  return (
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>Motivation Factors</Text>
                      {sentences.map((s, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                      ))}
                    </View>
                  );
                }
                return (
                  <View>
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>Motivation Factors</Text>
                      <Text style={styles.listItem}>1. {safeString(sentences[0])}</Text>
                    </View>
                    {sentences.slice(1).map((s, i) => (
                      <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(s)}</Text>
                    ))}
                  </View>
                );
              }
              if (items.length <= 4) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Motivation Factors</Text>
                    {items.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Motivation Factors</Text>
                    <Text style={styles.listItem}>1. {safeString(items[0])}</Text>
                  </View>
                  {items.slice(1).map((item, i) => (
                    <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(item)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Previous Treatment Response */}
            {record.previousTreatmentResponse && (() => {
              const sentences = splitBySentence(record.previousTreatmentResponse);
              if (sentences.length <= 4) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Previous Treatment Response</Text>
                    {sentences.map((s, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Previous Treatment Response</Text>
                    <Text style={styles.listItem}>1. {safeString(sentences[0])}</Text>
                  </View>
                  {sentences.slice(1).map((s, i) => (
                    <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Insight Level */}
            {record.insightLevel && (() => {
              const sentences = splitBySentence(record.insightLevel);
              if (sentences.length <= 4) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Insight Level</Text>
                    {sentences.map((s, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Insight Level</Text>
                    <Text style={styles.listItem}>1. {safeString(sentences[0])}</Text>
                  </View>
                  {sentences.slice(1).map((s, i) => (
                    <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Assessment */}
            {record.assessment && (() => {
              const sentences = splitBySentence(record.assessment);
              if (sentences.length <= 4) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Assessment</Text>
                    {sentences.map((s, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Assessment</Text>
                    <Text style={styles.listItem}>1. {safeString(sentences[0])}</Text>
                  </View>
                  {sentences.slice(1).map((s, i) => (
                    <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Findings */}
            {record.findings && (() => {
              const sentences = splitBySentence(record.findings);
              return (
                <View wrap={sentences.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  {sentences.map((s, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Plan */}
            {record.plan && (() => {
              const sentences = splitBySentence(record.plan);
              return (
                <View wrap={sentences.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  {sentences.map((s, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Recommendations (array of {recommendation, date} objects or strings) */}
            {Array.isArray(record.recommendations) && hasContent(record.recommendations) && (() => {
              const items = record.recommendations
                .map(flattenRecommendation)
                .filter(line => line && line.trim());
              if (items.length === 0) return null;
              return (
                <View wrap={items.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {items.map((line, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {line}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Results (dynamic-key object: {Label: value}) */}
            {record.results && typeof record.results === 'object' && !Array.isArray(record.results) &&
              hasContent(record.results) && (() => {
              const entries = Object.entries(record.results).filter(([, v]) => hasContent(v));
              if (entries.length === 0) return null;
              return (
                <View wrap={entries.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {entries.map(([key, val], i) => (
                    <View key={i} style={styles.noteGroup}>
                      <Text style={styles.fieldLabel}>{safeString(humanizeKey(key))}</Text>
                      <Text style={styles.fieldValue}>{safeString(val)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Mortality */}
            {record.mortality && (() => {
              const sentences = splitBySentence(record.mortality);
              return (
                <View wrap={sentences.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Mortality</Text>
                  {sentences.map((s, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Notes */}
            {record.notes && (() => {
              const groups = parseNotesWithLabels(record.notes);
              const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

              if (totalItems <= 4) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    {groups.map((group, gIdx) => (
                      <View key={gIdx} style={styles.noteGroup}>
                        {group.label && (
                          <Text style={styles.noteLabel}>{safeString(group.label)}:</Text>
                        )}
                        {group.items.map((item, iIdx) => (
                          <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {safeString(item)}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              }

              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    {groups[0] && (
                      <View style={styles.noteGroup}>
                        {groups[0].label && (
                          <Text style={styles.noteLabel}>{safeString(groups[0].label)}:</Text>
                        )}
                        {groups[0].items[0] && (
                          <Text style={styles.listItem}>1. {safeString(groups[0].items[0])}</Text>
                        )}
                      </View>
                    )}
                  </View>
                  {groups.map((group, gIdx) => (
                    <View key={gIdx} style={styles.noteGroup}>
                      {gIdx > 0 && group.label && (
                        <Text style={styles.noteLabel}>{safeString(group.label)}:</Text>
                      )}
                      {group.items.slice(gIdx === 0 ? 1 : 0).map((item, iIdx) => (
                        <Text key={iIdx} style={styles.listItem}>
                          {(gIdx === 0 ? iIdx + 2 : iIdx + 1)}. {safeString(item)}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Functional Status */}
            {record.functionalStatus && (() => {
              const sentences = splitBySentence(record.functionalStatus);
              if (sentences.length <= 8) {
                return (
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Functional Status</Text>
                    {sentences.map((s, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                    ))}
                  </View>
                );
              }
              return (
                <View>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Functional Status</Text>
                    <Text style={styles.listItem}>1. {safeString(sentences[0])}</Text>
                  </View>
                  {sentences.slice(1).map((s, i) => (
                    <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(s)}</Text>
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

export default PrognosisDocumentPDFTemplate;
