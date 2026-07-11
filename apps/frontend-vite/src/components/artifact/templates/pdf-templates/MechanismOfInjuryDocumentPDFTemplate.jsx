import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * MechanismOfInjuryDocumentPDFTemplate
 * PDF export template for mechanism of injury records
 *
 * Features:
 * - Helvetica font (readable)
 * - 12pt content font sizes
 * - wrap={false} on sections
 * - Bar chart visualization for causation/mechanism type
 * - Numbers for lists (not dashes)
 * - parseFindingsWithLabels for structured content
 *
 * Created: December 2025
 */

// Styles following December 2025 PDF standards
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
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  recordCard: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#1e40af',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#374151',
  },
  fieldBlock: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    marginBottom: 4,
  },
  listItem: {
    fontSize: 12,
    paddingLeft: 8,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  contentText: {
    fontSize: 12,
    marginBottom: 6,
    paddingLeft: 8,
    lineHeight: 1.4,
  },
  // Parsed sections with subtitles
  groupBlock: {
    marginBottom: 10,
    paddingLeft: 8,
  },
  groupSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#1f2937',
  },
  groupItem: {
    fontSize: 12,
    paddingLeft: 12,
    marginBottom: 3,
    lineHeight: 1.4,
  },
});

// Chart styles
const chartStyles = StyleSheet.create({
  chartSection: {
    marginBottom: 18,
    padding: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#94a3b8',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    color: '#374151',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 9,
    color: '#4b5563',
  },
  barChartRow: {
    marginBottom: 14,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 4,
  },
  barCategoryValue: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#94a3b8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  scaleItem: {
    fontSize: 8,
    color: '#6b7280',
  },
  barScaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  scaleLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  barInterpretation: {
    fontSize: 9,
    marginTop: 4,
    paddingLeft: 4,
  },
});

// Extract occupational causation percentage from assessment text
const extractCausationPercentage = (assessment) => {
  if (!assessment) return null;
  const text = String(assessment);

  const patterns = [
    /(\d+(?:\.\d+)?)\s*%\s*(?:occupational|work[- ]?related|industrial|job[- ]?related)\s*(?:causation|cause|origin|etiology)?/i,
    /(?:occupational|work[- ]?related|industrial)\s*(?:causation|cause|origin|etiology)[:\s]+(\d+(?:\.\d+)?)\s*%/i,
    /causation[:\s]+(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:causation)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }

  return null;
};

// Get causation severity for bar chart
const getCausationSeverity = (percentage) => {
  if (percentage === null || percentage === undefined) return null;

  if (percentage === 100) {
    return { level: 4, percentage: 100, color: '#ef4444', label: '100% Occupational', description: 'Fully attributable to work/occupation' };
  }
  if (percentage >= 75) {
    return { level: 3, percentage: percentage, color: '#f97316', label: `${percentage}% Occupational`, description: 'Primarily attributable to work/occupation' };
  }
  if (percentage >= 50) {
    return { level: 2, percentage: percentage, color: '#f59e0b', label: `${percentage}% Occupational`, description: 'Significantly attributable to work/occupation' };
  }
  if (percentage >= 25) {
    return { level: 1, percentage: percentage, color: '#3b82f6', label: `${percentage}% Occupational`, description: 'Partially attributable to work/occupation' };
  }
  return { level: 0, percentage: Math.max(15, percentage), color: '#22c55e', label: `${percentage}% Occupational`, description: 'Minimal occupational contribution' };
};

// Get mechanism type severity
const getMechanismSeverity = (mechanism) => {
  if (!mechanism) return null;
  const mechLower = String(mechanism).toLowerCase();

  if (mechLower.includes('mva') || mechLower.includes('motor vehicle') || mechLower.includes('collision') ||
      mechLower.includes('crush') || mechLower.includes('fall from height')) {
    return { level: 4, label: 'High Energy', color: '#ef4444', description: 'High energy mechanism - potential for severe injury' };
  }
  if (mechLower.includes('fall') || mechLower.includes('contact') || mechLower.includes('direct trauma') ||
      mechLower.includes('struck by')) {
    return { level: 3, label: 'Moderate Energy', color: '#f97316', description: 'Moderate energy mechanism' };
  }
  if (mechLower.includes('repetitive') || mechLower.includes('overuse') || mechLower.includes('cumulative') ||
      mechLower.includes('strain')) {
    return { level: 2, label: 'Repetitive/Overuse', color: '#f59e0b', description: 'Repetitive or cumulative trauma' };
  }
  if (mechLower.includes('twist') || mechLower.includes('non-contact') || mechLower.includes('lifting') ||
      mechLower.includes('bending')) {
    return { level: 1, label: 'Low Energy', color: '#3b82f6', description: 'Low energy or non-contact mechanism' };
  }

  return { level: 1, label: 'Other', color: '#9ca3af', description: 'Injury mechanism documented' };
};

// PDF Legend
const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#22c55e' }]} />
      <Text style={chartStyles.legendText}>Minimal (0-24%)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#3b82f6' }]} />
      <Text style={chartStyles.legendText}>Low (25-49%)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#f59e0b' }]} />
      <Text style={chartStyles.legendText}>Moderate (50-74%)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#f97316' }]} />
      <Text style={chartStyles.legendText}>Significant (75-99%)</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#ef4444' }]} />
      <Text style={chartStyles.legendText}>High (100%)</Text>
    </View>
  </View>
);

// PDF Bar Chart
const PDFBarChart = ({ label, severity, isQualitative }) => {
  if (!severity) return null;
  const percentage = isQualitative ? (severity.level / 4) * 100 : Math.min(100, Math.max(15, severity.percentage || 0));

  return (
    <View style={chartStyles.barChartRow}>
      <Text style={chartStyles.barLabel}>{String(label)}</Text>
      <Text style={[chartStyles.barCategoryValue, { color: severity.color }]}>
        {String(severity.label)}
      </Text>
      <View style={chartStyles.barContainer}>
        <View style={chartStyles.barBackground}>
          <View style={[chartStyles.barFill, { width: `${percentage}%`, backgroundColor: severity.color }]} />
        </View>
      </View>
      {isQualitative && (
        <View style={chartStyles.barScale}>
          <Text style={chartStyles.scaleItem}>0</Text>
          <Text style={chartStyles.scaleItem}>1</Text>
          <Text style={chartStyles.scaleItem}>2</Text>
          <Text style={chartStyles.scaleItem}>3</Text>
          <Text style={chartStyles.scaleItem}>4</Text>
        </View>
      )}
      {isQualitative && (
        <View style={chartStyles.barScaleLabels}>
          <Text style={[chartStyles.scaleLabel, { color: '#22c55e' }]}>Minimal</Text>
          <Text style={[chartStyles.scaleLabel, { color: '#3b82f6' }]}>Low</Text>
          <Text style={[chartStyles.scaleLabel, { color: '#f59e0b' }]}>Moderate</Text>
          <Text style={[chartStyles.scaleLabel, { color: '#f97316' }]}>Significant</Text>
          <Text style={[chartStyles.scaleLabel, { color: '#ef4444' }]}>High</Text>
        </View>
      )}
      <Text style={[chartStyles.barInterpretation, { color: severity.color }]}>
        {String(severity.description)}
      </Text>
    </View>
  );
};

// Safe string conversion
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.filter(Boolean).join(', ');
  return String(val);
};

// Split text into sentences by periods, preserving titles like Mr., Dr., etc.
const splitIntoSentences = (text) => {
  if (!text) return [];
  const textStr = safeString(text);
  // Split by period followed by space, but NOT after common titles
  const sentences = textStr.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Co))\.\s+/);
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
};

// Check if content looks like a date/time
const isDateTimePattern = (str) => {
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                      'july', 'august', 'september', 'october', 'november', 'december'];
  const lowerStr = str.toLowerCase();
  const hasMonthName = monthNames.some(m => lowerStr.includes(m));
  const hasYearPattern = /\b\d{4}\b/.test(str);
  const hasTimePattern = /\d{1,2}:\d{2}/.test(str);
  return hasMonthName && (hasYearPattern || hasTimePattern);
};

// Parse text with "Label: value" patterns
const parseFindingsWithLabels = (text) => {
  if (!text) return [];
  const textStr = safeString(text);
  const lines = textStr.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  const groups = [];
  let currentGroup = null;

  const extractLabel = (segment) => {
    if (!segment || typeof segment !== 'string') return null;
    const colonIdx = segment.indexOf(':');
    if (colonIdx === -1 || colonIdx < 2 || colonIdx > 100) return null;

    // Skip time patterns like "10:30" - check if colon is between digits
    const charBefore = segment[colonIdx - 1];
    const charAfter = segment[colonIdx + 1];
    if (/\d/.test(charBefore) && /\d/.test(charAfter)) return null;

    const beforeColon = segment.substring(0, colonIdx).trim();
    const afterColon = segment.substring(colonIdx + 1).trim();
    if (!/^[A-Z]/.test(beforeColon) || !afterColon) return null;
    if (beforeColon.includes('.')) return null;
    return { label: beforeColon, content: afterColon };
  };

  const splitByEmbeddedLabels = (content) => {
    const segments = content.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(s => s.length > 0);
    return segments;
  };

  const splitByComma = (content) => {
    if (isDateTimePattern(content)) return [content];
    if (!content.includes(',')) return [content];
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
    return items.length > 0 ? items : [content];
  };

  for (const line of lines) {
    const lineLabel = extractLabel(line);
    if (lineLabel) {
      if (currentGroup) groups.push(currentGroup);
      const segments = splitByEmbeddedLabels(lineLabel.content);
      if (segments.length > 1) {
        let firstSegment = segments[0];
        const firstLabelCheck = extractLabel(firstSegment);
        if (firstLabelCheck) {
          currentGroup = { label: lineLabel.label, items: [] };
          groups.push(currentGroup);
          currentGroup = { label: firstLabelCheck.label, items: splitByComma(firstLabelCheck.content) };
        } else {
          currentGroup = { label: lineLabel.label, items: splitByComma(firstSegment) };
        }
        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          const segLabel = extractLabel(seg);
          if (currentGroup) groups.push(currentGroup);
          if (segLabel) {
            currentGroup = { label: segLabel.label, items: splitByComma(segLabel.content) };
          } else {
            currentGroup = { label: '', items: [seg] };
          }
        }
      } else {
        currentGroup = { label: lineLabel.label, items: splitByComma(lineLabel.content) };
      }
    } else {
      const segments = splitByEmbeddedLabels(line);
      for (const seg of segments) {
        const segLabel = extractLabel(seg);
        if (currentGroup) groups.push(currentGroup);
        if (segLabel) {
          currentGroup = { label: segLabel.label, items: splitByComma(segLabel.content) };
        } else {
          currentGroup = { label: '', items: [seg] };
        }
      }
    }
  }
  if (currentGroup) groups.push(currentGroup);
  return groups.filter(g => g.label || g.items.length > 0);
};

// Format date
const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return safeString(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(dateVal);
  }
};

const MechanismOfInjuryDocumentPDFTemplate = ({ document: doc }) => {
  // Unwrap data
  let records = [];
  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc?.mechanism_of_injury) {
    records = Array.isArray(doc.mechanism_of_injury) ? doc.mechanism_of_injury : [doc.mechanism_of_injury];
  } else if (doc?.documentData?.mechanism_of_injury) {
    records = Array.isArray(doc.documentData.mechanism_of_injury) ? doc.documentData.mechanism_of_injury : [doc.documentData.mechanism_of_injury];
  } else if (doc?.documentData) {
    records = Array.isArray(doc.documentData) ? doc.documentData : [doc.documentData];
  } else if (doc && typeof doc === 'object') {
    records = [doc];
  }

  records = records.filter(r => r && Object.keys(r).length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.documentTitle}>Mechanism of Injury</Text>
        </View>

        {/* Records */}
        {records.map((record, idx) => {
          const causationPercentage = extractCausationPercentage(record.assessment);
          const causationSeverity = getCausationSeverity(causationPercentage);
          const mechanismSeverity = getMechanismSeverity(record.mechanism);
          const hasChartData = causationSeverity || mechanismSeverity;

          return (
            <View key={idx} style={styles.recordCard}>
              <Text style={styles.recordTitle}>Mechanism of Injury {idx + 1}</Text>

              {/* Injury Analysis Chart */}
              {hasChartData && (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={chartStyles.chartTitle}>Injury Analysis</Text>
                  <PDFLegend />
                  {causationSeverity && (
                    <PDFBarChart
                      label="Occupational Causation"
                      severity={causationSeverity}
                      isQualitative={false}
                    />
                  )}
                  {mechanismSeverity && (
                    <PDFBarChart
                      label="Mechanism Type"
                      severity={mechanismSeverity}
                      isQualitative={true}
                    />
                  )}
                </View>
              )}

              {/* Injury Details */}
              {(record.dateOfInjury || record.mechanism || record.activity) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Injury Details</Text>
                  {record.dateOfInjury && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Date of Injury</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.dateOfInjury)}</Text>
                    </View>
                  )}
                  {record.mechanism && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Mechanism</Text>
                      {splitIntoSentences(record.mechanism).map((sentence, sIdx) => (
                        <Text key={sIdx} style={styles.fieldValue}>
                          {sentence + (sentence.endsWith('.') ? '' : '.')}
                        </Text>
                      ))}
                    </View>
                  )}
                  {record.activity && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Activity</Text>
                      <Text style={styles.fieldValue}>{safeString(record.activity)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Immediate Symptoms */}
              {record.immediateSymptoms?.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Immediate Symptoms</Text>
                  {record.immediateSymptoms.map((sym, symIdx) => (
                    <Text key={symIdx} style={styles.listItem}>
                      {symIdx + 1}. {safeString(sym)}
                    </Text>
                  ))}
                </View>
              )}

              {/* Treatment */}
              {(record.initialTreatment || record.timeToSurgery) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Treatment</Text>
                  {record.initialTreatment && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Initial Treatment</Text>
                      {splitIntoSentences(record.initialTreatment).map((sentence, sIdx) => (
                        <Text key={sIdx} style={styles.fieldValue}>
                          {sentence + (sentence.endsWith('.') ? '' : '.')}
                        </Text>
                      ))}
                    </View>
                  )}
                  {record.timeToSurgery && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Time to Surgery</Text>
                      <Text style={styles.fieldValue}>{safeString(record.timeToSurgery)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Findings - Parsed with subtitles and numbering */}
              {record.findings && (() => {
                const parsedGroups = parseFindingsWithLabels(record.findings);
                let itemNumber = 1;

                return (
                  <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    {parsedGroups.map((group, gIdx) => (
                      <View key={gIdx} style={styles.groupBlock}>
                        {group.label && (
                          <Text style={styles.groupSubtitle}>{group.label}</Text>
                        )}
                        {group.items.map((item, iIdx) => (
                          <Text key={iIdx} style={styles.groupItem}>
                            {itemNumber++}. {safeString(item)}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Assessment - Parsed with subtitles and numbering */}
              {record.assessment && (() => {
                const parsedGroups = parseFindingsWithLabels(record.assessment);
                let itemNumber = 1;

                return (
                  <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Assessment</Text>
                    {parsedGroups.map((group, gIdx) => (
                      <View key={gIdx} style={styles.groupBlock}>
                        {group.label && (
                          <Text style={styles.groupSubtitle}>{group.label}</Text>
                        )}
                        {group.items.map((item, iIdx) => (
                          <Text key={iIdx} style={styles.groupItem}>
                            {itemNumber++}. {safeString(item)}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Plan - Parsed with subtitles and numbering */}
              {record.plan && (() => {
                const parsedGroups = parseFindingsWithLabels(record.plan);
                let itemNumber = 1;

                return (
                  <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Plan</Text>
                    {parsedGroups.map((group, gIdx) => (
                      <View key={gIdx} style={styles.groupBlock}>
                        {group.label && (
                          <Text style={styles.groupSubtitle}>{group.label}</Text>
                        )}
                        {group.items.map((item, iIdx) => (
                          <Text key={iIdx} style={styles.groupItem}>
                            {itemNumber++}. {safeString(item)}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Notes - Parsed with subtitles and numbering */}
              {record.notes && (() => {
                const parsedGroups = parseFindingsWithLabels(record.notes);
                let itemNumber = 1;

                return (
                  <View style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    {parsedGroups.map((group, gIdx) => (
                      <View key={gIdx} style={styles.groupBlock}>
                        {group.label && (
                          <Text style={styles.groupSubtitle}>{group.label}</Text>
                        )}
                        {group.items.map((item, iIdx) => (
                          <Text key={iIdx} style={styles.groupItem}>
                            {itemNumber++}. {safeString(item)}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Recommendations */}
              {record.recommendations?.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {record.recommendations.map((rec, recIdx) => (
                    <Text key={recIdx} style={styles.listItem}>
                      {recIdx + 1}. {safeString(rec)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default MechanismOfInjuryDocumentPDFTemplate;
