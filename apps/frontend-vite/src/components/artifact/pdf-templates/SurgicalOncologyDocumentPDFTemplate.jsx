/**
 * SurgicalOncologyDocumentPDFTemplate.jsx
 * PDF export template for surgical_oncology collection
 * March 2026 - Helvetica font, LETTER size, 20pt header / 12pt content
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
    paddingBottom: 10,
  },
  recordCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  recordHeader: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  recordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaItem: {
    fontSize: 11,
    color: '#666666',
  },
  section: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    color: '#333333',
  },
  fieldBlock: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
    color: '#1f2937',
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    color: '#3a3a3a',
  },
  listItem: {
    fontSize: 12,
    paddingLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  booleanPositive: {
    fontSize: 12,
    lineHeight: 1.4,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
  },
  booleanNegative: {
    fontSize: 12,
    lineHeight: 1.4,
    color: '#3a3a3a',
  },
  listItemSub: {
    fontSize: 11,
    paddingLeft: 20,
    marginBottom: 3,
    lineHeight: 1.4,
    color: '#3a3a3a',
  },
});

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    if (dateVal.$date) return new Date(dateVal.$date).toLocaleDateString();
    if (dateVal instanceof Date) return dateVal.toLocaleDateString();
    return new Date(dateVal).toLocaleDateString();
  } catch {
    return String(dateVal);
  }
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
/* flatten a nested OBJECT into [{label, value, depth}] leaf rows (value undefined = group header) */
const objectRows = (obj, depth = 0, out = []) => {
  if (isEmptyDeep(obj) || isScalar(obj)) return out;
  Object.entries(obj).forEach(([k, v]) => {
    if (isEmptyDeep(v)) return;
    if (isScalar(v)) out.push({ label: humanizeKey(k), value: fmtScalar(v), depth });
    else { out.push({ label: humanizeKey(k), value: undefined, depth }); objectRows(v, depth + 1, out); }
  });
  return out;
};

const SurgicalOncologyDocumentPDFTemplate = ({ document: records }) => {
  // Handle data unwrapping
  let recordsArray = [];
  if (Array.isArray(records)) {
    recordsArray = records;
  } else if (records?.surgical_oncology && Array.isArray(records.surgical_oncology)) {
    recordsArray = records.surgical_oncology;
  } else if (records?.documentData) {
    const docData = records.documentData;
    if (Array.isArray(docData)) {
      recordsArray = docData;
    } else if (docData?.surgical_oncology && Array.isArray(docData.surgical_oncology)) {
      recordsArray = docData.surgical_oncology;
    } else if (docData && typeof docData === 'object') {
      recordsArray = [docData];
    }
  } else if (records && typeof records === 'object' && !Array.isArray(records)) {
    recordsArray = [records];
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>Surgical Oncology</Text>

        {recordsArray.map((record, idx) => {
          const pf = record.pathologyFindings || {};
          const hasPathology = pf.tumorSize || pf.margins || pf.lymphNodesExamined ||
                               pf.lymphNodesPositive || pf.extrandalExtension !== undefined ||
                               pf.lymphovascularInvasion !== undefined || pf.perineuralInvasion !== undefined;
          const reconRows = objectRows(record.reconstruction);
          const resultRows = objectRows(record.results);
          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => r && (r.recommendation || '').trim()) : [];

          return (
            <View key={idx} style={styles.recordCard}>
              {/* Record Header */}
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>Surgical Oncology {idx + 1}</Text>
                <View style={styles.recordMeta}>
                  {record.date && <Text style={styles.metaItem}>Date: {formatDate(record.date)}</Text>}
                  {record.status && <Text style={styles.metaItem}>Status: {String(record.status)}</Text>}
                </View>
              </View>

              {/* Procedure Information */}
              {(record.procedureType || record.dateOfSurgery || record.surgeon || record.provider || record.facility) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Procedure Information</Text>
                  {record.procedureType && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Procedure Type</Text>
                      <Text style={styles.fieldValue}>{String(record.procedureType)}</Text>
                    </View>
                  )}
                  {record.dateOfSurgery && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Date of Surgery</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.dateOfSurgery)}</Text>
                    </View>
                  )}
                  {record.surgeon && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Surgeon</Text>
                      <Text style={styles.fieldValue}>{String(record.surgeon)}</Text>
                    </View>
                  )}
                  {record.provider && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Provider</Text>
                      <Text style={styles.fieldValue}>{String(record.provider)}</Text>
                    </View>
                  )}
                  {record.facility && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Facility</Text>
                      <Text style={styles.fieldValue}>{String(record.facility)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Pathology Findings */}
              {hasPathology && (
                <View style={styles.section}>
                  {/* Title + first item together */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Pathology Findings</Text>
                    {pf.tumorSize && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldSubtitle}>Tumor Size</Text>
                        <Text style={styles.fieldValue}>{String(pf.tumorSize)}</Text>
                      </View>
                    )}
                  </View>
                  {pf.margins && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Margins</Text>
                      <Text style={styles.fieldValue}>{String(pf.margins)}</Text>
                    </View>
                  )}
                  {pf.lymphNodesExamined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Lymph Nodes Examined</Text>
                      <Text style={styles.fieldValue}>{String(pf.lymphNodesExamined)}</Text>
                    </View>
                  )}
                  {pf.lymphNodesPositive && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Lymph Nodes Positive</Text>
                      <Text style={styles.fieldValue}>{String(pf.lymphNodesPositive)}</Text>
                    </View>
                  )}
                  {pf.extrandalExtension !== undefined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Extranodal Extension</Text>
                      <Text style={pf.extrandalExtension ? styles.booleanPositive : styles.booleanNegative}>
                        {pf.extrandalExtension ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  )}
                  {pf.lymphovascularInvasion !== undefined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Lymphovascular Invasion</Text>
                      <Text style={pf.lymphovascularInvasion ? styles.booleanPositive : styles.booleanNegative}>
                        {pf.lymphovascularInvasion ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  )}
                  {pf.perineuralInvasion !== undefined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Perineural Invasion</Text>
                      <Text style={pf.perineuralInvasion ? styles.booleanPositive : styles.booleanNegative}>
                        {pf.perineuralInvasion ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Reconstruction (OBJECT, recursive) */}
              {reconRows.length > 0 && (
                <View style={styles.section} wrap={reconRows.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Reconstruction</Text>
                  {reconRows.map((row, rIdx) => (
                    <View key={rIdx} style={styles.fieldBlock}>
                      {row.value === undefined ? (
                        <Text style={styles.fieldSubtitle}>{row.label}</Text>
                      ) : (
                        <>
                          <Text style={styles.fieldSubtitle}>{row.label}</Text>
                          <Text style={row.depth > 0 ? styles.listItemSub : styles.fieldValue}>{row.value}</Text>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Findings */}
              {record.findings && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  <Text style={styles.fieldValue}>{String(record.findings)}</Text>
                </View>
              )}

              {/* Results (OBJECT, recursive) */}
              {resultRows.length > 0 && (
                <View style={styles.section} wrap={resultRows.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {resultRows.map((row, rIdx) => (
                    <View key={rIdx} style={styles.fieldBlock}>
                      {row.value === undefined ? (
                        <Text style={styles.fieldSubtitle}>{row.label}</Text>
                      ) : (
                        <>
                          <Text style={styles.fieldSubtitle}>{row.label}</Text>
                          <Text style={row.depth > 0 ? styles.listItemSub : styles.fieldValue}>{row.value}</Text>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Assessment */}
              {record.assessment && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  <Text style={styles.fieldValue}>{String(record.assessment)}</Text>
                </View>
              )}

              {/* Complications */}
              {Array.isArray(record.complications) && record.complications.length > 0 && (
                <View style={styles.section}>
                  {/* Title + first item together */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Complications</Text>
                    <Text style={styles.listItem}>1. {String(record.complications[0])}</Text>
                  </View>
                  {record.complications.slice(1).map((comp, cIdx) => (
                    <Text key={cIdx} style={styles.listItem}>
                      {cIdx + 2}. {String(comp)}
                    </Text>
                  ))}
                </View>
              )}

              {/* Plan */}
              {record.plan && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  <Text style={styles.fieldValue}>{String(record.plan)}</Text>
                </View>
              )}

              {/* Recommendations (ARRAY of {recommendation, date}) */}
              {recs.length > 0 && (
                <View style={styles.section} wrap={recs.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {recs.map((rec, recIdx) => {
                    const rt = (rec.recommendation || '').trim();
                    const rd = (rec.date || '').trim();
                    return (
                      <Text key={recIdx} style={styles.listItem}>
                        {recIdx + 1}. {rt}{rd ? ` (${rd})` : ''}
                      </Text>
                    );
                  })}
                </View>
              )}

              {/* Notes */}
              {record.notes && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.fieldValue}>{String(record.notes)}</Text>
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default SurgicalOncologyDocumentPDFTemplate;
