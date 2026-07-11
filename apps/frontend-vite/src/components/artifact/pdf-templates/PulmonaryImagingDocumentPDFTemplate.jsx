import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Pulmonary Imaging PDF Template - February 2026
 * Helvetica font, black & white, readable format
 * - Section title INSIDE fieldBox (NOT standalone sibling)
 * - NO borderBottom on sectionTitle
 * - wrap={false} for small sections
 * - safeString helper for all text values
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  documentSubtitle: {
    fontSize: 10,
    textAlign: 'center',
  },
  recordHeader: {
    marginBottom: 16,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  section: {
    marginBottom: 16,
  },
  fieldBox: {
    paddingVertical: 4,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  subtitleLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
    marginTop: 4,
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    marginBottom: 4,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  itemNumber: {
    width: 24,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  itemContent: {
    flex: 1,
    fontSize: 12,
    lineHeight: 1.4,
  },
  arrayItem: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 8,
    textAlign: 'center',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 16,
    right: 40,
    fontSize: 9,
  },
});

// ============== HELPER FUNCTIONS ==============

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
  str = str.replace(/←/g, '<-');
  str = str.replace(/×/g, 'x');
  str = str.replace(/÷/g, '/');
  str = str.replace(/•/g, '-');
  str = str.replace(/–/g, '-');
  str = str.replace(/—/g, '-');
  str = str.replace(/\u201C/g, '"');
  str = str.replace(/\u201D/g, '"');
  str = str.replace(/\u2018/g, "'");
  str = str.replace(/\u2019/g, "'");
  return str;
};

const formatDatePDF = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(dateString);
  }
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc))\.\s+/)
    .map(s => s.replace(/\.$/, '').trim())
    .filter(Boolean);
};

// ============== MAIN COMPONENT ==============

const PulmonaryImagingDocumentPDFTemplate = ({ document: docProp, data, templateData }) => {
  const raw = templateData || docProp || data;

  // Data unwrapping (3-prop pattern)
  let records = [];
  if (!raw) {
    records = [];
  } else if (Array.isArray(raw)) {
    records = raw;
  } else if (raw?.pulmonary_imaging) {
    records = raw.pulmonary_imaging;
  } else if (raw?.documentData) {
    const docData = raw.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.pulmonary_imaging) {
      records = docData.pulmonary_imaging;
    } else {
      records = [docData];
    }
  } else if (typeof raw === 'object') {
    records = [raw];
  }

  records = records.filter(r => r !== null && r !== undefined);

  return (
    <Document>
      {records.map((record, recordIdx) => {
        const recs = Array.isArray(record.recommendations) ? record.recommendations : [];
        const findingsSentences = record._findingsSentences || splitBySentence(record.findings);
        const notesSentences = record._notesSentences || splitBySentence(record.notes);

        return (
          <Page key={recordIdx} size="LETTER" style={styles.page}>
            {/* Document Header */}
            <View style={styles.documentHeader} fixed>
              <Text style={styles.documentTitle}>Pulmonary Imaging</Text>
              <Text style={styles.documentSubtitle}>
                Generated: {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                Pulmonary Imaging Record {recordIdx + 1}
              </Text>
            </View>

            {/* Provider Details */}
            {(() => {
              const providerFields = [
                record.date ? ['Date', formatDatePDF(record.date)] : null,
                record.provider ? ['Provider', safeString(record.provider)] : null,
                record.facility ? ['Facility', safeString(record.facility)] : null,
                hasValue(record.status) ? ['Status', safeString(record.status)] : null,
              ].filter(Boolean);
              if (providerFields.length === 0) return null;
              return (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Provider Details</Text>
                  {providerFields.map(([label, val], i) => (
                    <View key={i}>
                      <Text style={styles.subtitleLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Imaging Studies */}
            {(() => {
              const studyFields = [
                record.chestXray ? ['Chest X-Ray', safeString(record.chestXray)] : null,
                record.ctChest ? ['CT Chest', safeString(record.ctChest)] : null,
                record.ventilationPerfusion ? ['Ventilation/Perfusion', safeString(record.ventilationPerfusion)] : null,
                record.pulmonaryAngiography ? ['Pulmonary Angiography', safeString(record.pulmonaryAngiography)] : null,
              ].filter(Boolean);
              if (studyFields.length === 0) return null;
              return (
                <View style={styles.fieldBox} wrap={studyFields.length > 3 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Imaging Studies</Text>
                  {studyFields.map(([label, val], i) => (
                    <View key={i}>
                      <Text style={styles.subtitleLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Findings */}
            {findingsSentences.length > 0 && (() => {
              const isSmall = findingsSentences.length <= 4;
              if (isSmall) {
                return (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    {findingsSentences.map((sentence, idx) => (
                      <View key={idx} style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{idx + 1}.</Text>
                        <Text style={styles.itemContent}>
                          {safeString(sentence)}{sentence.endsWith('.') ? '' : '.'}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              }
              return (
                <View style={styles.fieldBox}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    {findingsSentences.slice(0, 1).map((sentence, idx) => (
                      <View key={idx} style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{idx + 1}.</Text>
                        <Text style={styles.itemContent}>
                          {safeString(sentence)}{sentence.endsWith('.') ? '' : '.'}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {findingsSentences.slice(1).map((sentence, idx) => (
                    <View key={idx + 1} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{idx + 2}.</Text>
                      <Text style={styles.itemContent}>
                        {safeString(sentence)}{sentence.endsWith('.') ? '' : '.'}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Results */}
            {hasValue(record.results) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Results</Text>
                <Text style={styles.fieldValue}>{safeString(record.results)}</Text>
              </View>
            )}

            {/* Assessment */}
            {hasValue(record.assessment) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <Text style={styles.fieldValue}>{safeString(record.assessment)}</Text>
              </View>
            )}

            {/* Plan */}
            {hasValue(record.plan) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Plan</Text>
                <Text style={styles.fieldValue}>{safeString(record.plan)}</Text>
              </View>
            )}

            {/* Recommendations */}
            {recs.length > 0 && (() => {
              const isSmall = recs.length <= 4;
              if (isSmall) {
                return (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {recs.map((rec, idx) => {
                      const recText = typeof rec === 'object' ? (rec.recommendation || rec.__simpleType || '') : rec;
                      return (
                        <View key={idx} style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{idx + 1}.</Text>
                          <Text style={styles.itemContent}>{safeString(recText)}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              }
              return (
                <View style={styles.fieldBox}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {recs.slice(0, 1).map((rec, idx) => {
                      const recText = typeof rec === 'object' ? (rec.recommendation || rec.__simpleType || '') : rec;
                      return (
                        <View key={idx} style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{idx + 1}.</Text>
                          <Text style={styles.itemContent}>{safeString(recText)}</Text>
                        </View>
                      );
                    })}
                  </View>
                  {recs.slice(1).map((rec, idx) => {
                    const recText = typeof rec === 'object' ? (rec.recommendation || rec.__simpleType || '') : rec;
                    return (
                      <View key={idx + 1} style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{idx + 2}.</Text>
                        <Text style={styles.itemContent}>{safeString(recText)}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Notes */}
            {notesSentences.length > 0 && (() => {
              const isSmall = notesSentences.length <= 4;
              if (isSmall) {
                return (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    {notesSentences.map((sentence, idx) => (
                      <View key={idx} style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{idx + 1}.</Text>
                        <Text style={styles.itemContent}>
                          {safeString(sentence)}{sentence.endsWith('.') ? '' : '.'}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              }
              return (
                <View style={styles.fieldBox}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    {notesSentences.slice(0, 1).map((sentence, idx) => (
                      <View key={idx} style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>{idx + 1}.</Text>
                        <Text style={styles.itemContent}>
                          {safeString(sentence)}{sentence.endsWith('.') ? '' : '.'}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {notesSentences.slice(1).map((sentence, idx) => (
                    <View key={idx + 1} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{idx + 2}.</Text>
                      <Text style={styles.itemContent}>
                        {safeString(sentence)}{sentence.endsWith('.') ? '' : '.'}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Footer */}
            <Text style={styles.footer} fixed>
              PROTECTED HEALTH INFORMATION (PHI) - Handle according to HIPAA regulations
            </Text>

            {/* Page Number */}
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              fixed
            />
          </Page>
        );
      })}
    </Document>
  );
};

export default PulmonaryImagingDocumentPDFTemplate;
