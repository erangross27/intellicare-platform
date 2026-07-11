import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * DisabilityEvaluationsDocumentPDFTemplate
 * PDF export template for disability evaluation records
 *
 * Features:
 * - Helvetica font (readable)
 * - 12pt content font sizes
 * - wrap={false} on sections
 * - Bar chart visualization for disability status
 * - Numbers for lists (not dashes)
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

// Disability status severity mapping
const getDisabilityStatusSeverity = (status) => {
  if (!status) return null;
  const statusLower = String(status).toLowerCase();

  if (statusLower.includes('full recovery') || statusLower.includes('no disability') || statusLower.includes('resolved')) {
    return { level: 0, label: 'Full Recovery', color: '#22c55e', description: 'No current disability - full recovery achieved' };
  }
  if (statusLower.includes('temporary partial') || statusLower.includes('tpd') || statusLower.includes('light duty')) {
    return { level: 1, label: 'Temporary Partial (TPD)', color: '#3b82f6', description: 'Temporary partial disability - can work with restrictions' };
  }
  if (statusLower.includes('temporary total') || statusLower.includes('ttd') || statusLower.includes('off work')) {
    return { level: 2, label: 'Temporary Total (TTD)', color: '#f59e0b', description: 'Temporary total disability - unable to work currently' };
  }
  if (statusLower.includes('permanent partial') || statusLower.includes('ppd')) {
    return { level: 3, label: 'Permanent Partial (PPD)', color: '#f97316', description: 'Permanent partial disability - ongoing work limitations' };
  }
  if (statusLower.includes('permanent total') || statusLower.includes('ptd')) {
    return { level: 4, label: 'Permanent Total (PTD)', color: '#ef4444', description: 'Permanent total disability - unable to work' };
  }
  if (statusLower.includes('active')) {
    return { level: 2, label: 'Active Disability', color: '#f59e0b', description: 'Active disability evaluation in progress' };
  }
  return null;
};

// Extract impairment percentage
const extractImpairmentRating = (assessment) => {
  if (!assessment) return null;
  const text = String(assessment);
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%\s*(?:whole\s*person\s*)?impairment/i,
    /(\d+(?:\.\d+)?)\s*%\s*WPI/i,
    /impairment[:\s]+(\d+(?:\.\d+)?)\s*%/i,
    /rating[:\s]+(\d+(?:\.\d+)?)\s*%/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  const rangeMatch = text.match(/(\d+)-(\d+)\s*%\s*(?:whole\s*person\s*)?impairment/i);
  if (rangeMatch) return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  return null;
};

// Impairment severity
const getImpairmentSeverity = (rating) => {
  if (rating === null || rating === undefined) return null;
  if (rating === 0) return { level: 0, percentage: 15, color: '#22c55e', description: 'No permanent impairment' };
  if (rating <= 5) return { level: 1, percentage: Math.max(15, rating * 2), color: '#3b82f6', description: 'Minimal impairment (1-5%)' };
  if (rating <= 15) return { level: 2, percentage: rating * 2, color: '#f59e0b', description: 'Mild impairment (6-15%)' };
  if (rating <= 30) return { level: 3, percentage: Math.min(60, rating * 1.5), color: '#f97316', description: 'Moderate impairment (16-30%)' };
  return { level: 4, percentage: Math.min(100, rating), color: '#ef4444', description: 'Severe impairment (>30%)' };
};

// PDF Legend
const PDFLegend = () => (
  <View style={chartStyles.legendContainer}>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#22c55e' }]} />
      <Text style={chartStyles.legendText}>Full Recovery</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#3b82f6' }]} />
      <Text style={chartStyles.legendText}>TPD</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#f59e0b' }]} />
      <Text style={chartStyles.legendText}>TTD</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#f97316' }]} />
      <Text style={chartStyles.legendText}>PPD</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#ef4444' }]} />
      <Text style={chartStyles.legendText}>PTD</Text>
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
        {String(severity.label || `${severity.percentage}%`)}
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
          <Text style={[chartStyles.scaleLabel, { color: '#22c55e' }]}>Recovery</Text>
          <Text style={[chartStyles.scaleLabel, { color: '#3b82f6' }]}>TPD</Text>
          <Text style={[chartStyles.scaleLabel, { color: '#f59e0b' }]}>TTD</Text>
          <Text style={[chartStyles.scaleLabel, { color: '#f97316' }]}>PPD</Text>
          <Text style={[chartStyles.scaleLabel, { color: '#ef4444' }]}>PTD</Text>
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

// Check if content looks like a date/time (contains month name + day + year pattern)
const isDateTimePattern = (str) => {
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                      'july', 'august', 'september', 'october', 'november', 'december'];
  const lowerStr = str.toLowerCase();
  const hasMonthName = monthNames.some(m => lowerStr.includes(m));
  const hasYearPattern = /\b\d{4}\b/.test(str);
  const hasTimePattern = /\d{1,2}:\d{2}/.test(str);
  return hasMonthName && (hasYearPattern || hasTimePattern);
};

// Parse text with "Label: value" patterns, detecting nested labels within content
const parseFindingsWithLabels = (text) => {
  if (!text) return [];
  const textStr = safeString(text);

  // Split by newlines first, then process each line for embedded labels
  const lines = textStr.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);

  const groups = [];
  let currentGroup = null;

  // Helper to check if text segment starts with a label
  const extractLabel = (segment) => {
    if (!segment || typeof segment !== 'string') return null;

    const colonIdx = segment.indexOf(':');
    if (colonIdx === -1 || colonIdx < 2 || colonIdx > 100) return null;

    const beforeColon = segment.substring(0, colonIdx).trim();
    const afterColon = segment.substring(colonIdx + 1).trim();

    if (!/^[A-Z]/.test(beforeColon) || !afterColon) return null;
    if (beforeColon.includes('.')) return null;

    return { label: beforeColon, content: afterColon };
  };

  // Split by period followed by space and capital letter
  const splitByEmbeddedLabels = (content) => {
    const segments = content.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(s => s.length > 0);
    return segments;
  };

  // Split items by comma, respecting parentheses and dates
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

const DisabilityEvaluationsDocumentPDFTemplate = ({ document: doc }) => {
  // Unwrap data
  let records = [];
  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc?.disability_evaluations) {
    records = Array.isArray(doc.disability_evaluations) ? doc.disability_evaluations : [doc.disability_evaluations];
  } else if (doc?.documentData?.disability_evaluations) {
    records = Array.isArray(doc.documentData.disability_evaluations) ? doc.documentData.disability_evaluations : [doc.documentData.disability_evaluations];
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
          <Text style={styles.documentTitle}>Disability Evaluations</Text>
        </View>

        {/* Records */}
        {records.map((record, idx) => {
          const statusSeverity = getDisabilityStatusSeverity(record.status);
          const impairmentRating = extractImpairmentRating(record.assessment);
          const impairmentSeverity = getImpairmentSeverity(impairmentRating);
          const hasChartData = statusSeverity || impairmentSeverity;

          return (
            <View key={idx} style={styles.recordCard}>
              <Text style={styles.recordTitle}>Disability Evaluation {idx + 1}</Text>

              {/* Disability Assessment Chart */}
              {hasChartData && (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={chartStyles.chartTitle}>Disability Assessment</Text>
                  <PDFLegend />
                  {statusSeverity && (
                    <PDFBarChart
                      label="Disability Status"
                      severity={statusSeverity}
                      isQualitative={true}
                    />
                  )}
                  {impairmentSeverity && (
                    <PDFBarChart
                      label="Impairment Rating"
                      severity={{ ...impairmentSeverity, label: `${impairmentRating}% WPI` }}
                      isQualitative={false}
                    />
                  )}
                </View>
              )}

              {/* Evaluation Information */}
              {(record.date || record.type || record.provider || record.facility) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Evaluation Information</Text>
                  {record.date && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Date</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                    </View>
                  )}
                  {record.type && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Type</Text>
                      <Text style={styles.fieldValue}>{safeString(record.type)}</Text>
                    </View>
                  )}
                  {record.provider && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Provider</Text>
                      <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                    </View>
                  )}
                  {record.facility && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Facility</Text>
                      <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
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

export default DisabilityEvaluationsDocumentPDFTemplate;
