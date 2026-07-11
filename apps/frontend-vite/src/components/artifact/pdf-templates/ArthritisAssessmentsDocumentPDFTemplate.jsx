import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Arthritis Assessments Document PDF Template
 * PDFDownloadLink + pdfData memo pattern
 * ASCII separators only (no unicode box-drawing)
 * Bar chart visualization for CRP and ESR
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 24,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#000000',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordMeta: {
    fontSize: 11,
    marginBottom: 16,
    color: '#333333',
    paddingLeft: 4,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  fieldContent: {
    fontSize: 12,
    lineHeight: 1.5,
    paddingLeft: 12,
    color: '#000000',
  },
  subLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    paddingLeft: 12,
    color: '#000000',
  },
  listItem: {
    fontSize: 12,
    lineHeight: 1.5,
    paddingLeft: 12,
    marginBottom: 4,
    color: '#000000',
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    fontSize: 14,
    color: '#666666',
  },
  // Bar Chart
  chartSection: {
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#7a7a7a',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 16,
    color: '#424242',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#7a7a7a',
    paddingBottom: 8,
  },
  chartRow: {
    marginBottom: 14,
  },
  chartLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#000000',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  barBackground: {
    flex: 1,
    height: 18,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    marginLeft: 12,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    minWidth: 70,
    textAlign: 'right',
    color: '#000000',
  },
  chartInterpretation: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    paddingLeft: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 9,
    color: '#333333',
  },
  separator: {
    fontSize: 10,
    color: '#999999',
    marginBottom: 8,
    textAlign: 'center',
  },
});

const getInterpretationColor = (interpretation) => {
  switch (interpretation?.toLowerCase()) {
    case 'normal': return '#6f6f6f';
    case 'elevated': return '#878787';
    case 'high': return '#5c5c5c';
    default: return '#606060';
  }
};

const extractChartData = (record) => {
  const chartData = [];
  if (!record?.inflammatoryMarkers) return chartData;
  const text = String(record.inflammatoryMarkers);

  const crpMatch = text.match(/CRP[:\s]*([0-9.]+)\s*(mg\/L)?/i);
  if (crpMatch) {
    const value = parseFloat(crpMatch[1]);
    const percentage = Math.min((value / 20) * 100, 100);
    let interpretation = 'Normal';
    if (value > 10) interpretation = 'High';
    else if (value > 3) interpretation = 'Elevated';
    chartData.push({ label: 'C-Reactive Protein (CRP)', value, unit: 'mg/L', percentage, interpretation, reference: '<3.0 mg/L', color: getInterpretationColor(interpretation) });
  }

  const esrMatch = text.match(/ESR[:\s]*([0-9.]+)\s*(mm\/hr)?/i);
  if (esrMatch) {
    const value = parseFloat(esrMatch[1]);
    const percentage = Math.min((value / 80) * 100, 100);
    let interpretation = 'Normal';
    if (value > 40) interpretation = 'High';
    else if (value > 25) interpretation = 'Elevated';
    chartData.push({ label: 'Erythrocyte Sedimentation Rate (ESR)', value, unit: 'mm/hr', percentage, interpretation, reference: '<20-30 mm/hr', color: getInterpretationColor(interpretation) });
  }

  return chartData;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateString; }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=\.)\s+|(?<=;)\s+/).filter(s => s.trim().length > 0);
};

/* splitByComma: parenthesis-aware comma split with thousands-digit guard (mirrors the JSX). */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && !(/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || ''))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* parseLabel: detect "Label: value" (mirrors the JSX). */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* pdfSafe: ASCII-map symbols the built-in Helvetica lacks (→ ≥ ≤ µ ± × °) so they don't render as
   garbage / eat the adjacent space (memory 6a40999). e.g. "4.2 → 5.8" → "4.2 -> 5.8". */
const pdfSafe = (s) => String(s == null ? '' : s)
  .replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=')
  .replace(/µ/g, 'u').replace(/±/g, '+/-').replace(/×/g, 'x').replace(/°/g, ' deg');

const ArthritisAssessmentsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.arthritis_assessments) {
        const v = r.arthritis_assessments;
        return Array.isArray(v) ? v : [v];
      }
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.arthritis_assessments) {
          const v = dd.arthritis_assessments;
          return Array.isArray(v) ? v : [v];
        }
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // Rule #74 page-break (react-pdf v4, memory 6a3cda8c): wrap={false} keeps a small block (title +
  // content) atomic so react-pdf moves it WHOLE to the next page → no orphaned title; for >8 rows
  // wrap={true} + glue [title + first row] in a wrap={false} sub-view so the list flows but the title
  // never orphans. NEVER wrap={undefined} (=== false on v4).
  const renderField = (label, value) => {
    if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null;
    // "Label: value" → fieldTitle (section) + sub-label + value (mirrors the JSX nested-subtitle; never side-by-side).
    const parsed = parseLabel(String(value));
    return (
      <View style={styles.fieldContainer} wrap={false}>
        <Text style={styles.fieldTitle}>{label}</Text>
        {parsed.isLabeled ? (
          <>
            <Text style={styles.subLabel}>{pdfSafe(parsed.label)}</Text>
            <Text style={styles.fieldContent}>{pdfSafe(parsed.value)}</Text>
          </>
        ) : (
          <Text style={styles.fieldContent}>{pdfSafe(value)}</Text>
        )}
      </View>
    );
  };

  const renderNumberedList = (label, items) => {
    const wrapItems = items.length > 8;
    return (
      <View style={styles.fieldContainer} wrap={wrapItems}>
        {wrapItems ? (
          <>
            <View wrap={false}>
              <Text style={styles.fieldTitle}>{label}</Text>
              <Text style={styles.listItem}>1. {pdfSafe(items[0])}</Text>
            </View>
            {items.slice(1).map((item, i) => (
              <Text key={i + 1} style={styles.listItem}>{i + 2}. {pdfSafe(item)}</Text>
            ))}
          </>
        ) : (
          <>
            <Text style={styles.fieldTitle}>{label}</Text>
            {items.map((item, i) => (
              <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>
            ))}
          </>
        )}
      </View>
    );
  };

  const renderArrayField = (label, items) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    return renderNumberedList(label, items);
  };

  const renderSentenceField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) return renderField(label, value);
    return renderNumberedList(label, sentences);
  };

  /* Comma-list field (followUp): one numbered row per comma item, paren-aware. Mirrors the JSX. */
  const renderCommaField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const items = splitByComma(String(value));
    if (items.length <= 1) return renderField(label, value);
    return renderNumberedList(label, items);
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Arthritis Assessments Report</Text>
          <Text style={styles.emptyState}>No arthritis assessment records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Arthritis Assessments Report</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection} break={idx > 0}>
            {/* Record Header */}
            <View wrap={false}>
              <Text style={styles.recordTitle}>
                {`Arthritis Assessment ${idx + 1}`}
              </Text>
              {record.date && (
                <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>
              )}
            </View>

            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}

            {/* Bar Chart */}
            {(() => {
              const chartData = extractChartData(record);
              if (chartData.length === 0) return null;
              return (
                <View style={styles.chartSection} wrap={false}>
                  <Text style={styles.chartTitle}>Inflammatory Markers Overview</Text>
                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#6f6f6f' }]} />
                      <Text style={styles.legendText}>Normal</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#878787' }]} />
                      <Text style={styles.legendText}>Elevated</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#5c5c5c' }]} />
                      <Text style={styles.legendText}>High</Text>
                    </View>
                  </View>
                  {chartData.map((item, cIdx) => (
                    <View key={cIdx} style={styles.chartRow}>
                      <Text style={styles.chartLabel}>{item.label}</Text>
                      <View style={styles.barContainer}>
                        <View style={styles.barBackground}>
                          <View style={[styles.barFill, { width: `${item.percentage}%`, backgroundColor: item.color }]} />
                        </View>
                        <Text style={styles.barValue}>{item.value} {item.unit}</Text>
                      </View>
                      <Text style={[styles.chartInterpretation, { color: item.color }]}>
                        {item.interpretation} (Ref: {item.reference})
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {renderField('Arthritis Type', record.arthritisType)}
            {renderArrayField('Affected Joints', record.affectedJoints)}
            {renderField('Pain Level', record.painLevel)}
            {renderField('Stiffness', record.stiffness)}
            {renderField('Swelling', record.swelling)}
            {renderSentenceField('Functional Limitations', record.functionalLimitations)}
            {renderField('Disease Activity', record.diseaseActivity)}
            {renderField('Inflammatory Markers', record.inflammatoryMarkers)}
            {renderField('Serology', record.serology)}
            {renderField('Imaging', record.imaging)}
            {renderArrayField('Current Medications', record.currentMedications)}
            {renderSentenceField('Medication Response', record.medicationResponse)}
            {renderField('Side Effects', record.sideEffects)}
            {renderSentenceField('Treatment Plan', record.treatmentPlan)}
            {renderField('Physical Therapy', record.physicalTherapy)}
            {renderCommaField('Follow Up', record.followUp)}
            {renderField('Rheumatologist', record.rheumatologist)}
            {renderField('Facility', record.facility)}
            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ArthritisAssessmentsDocumentPDFTemplate;
