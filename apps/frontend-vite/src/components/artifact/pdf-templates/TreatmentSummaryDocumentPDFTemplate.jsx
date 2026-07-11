/**
 * TreatmentSummaryDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — treatment summary
 * Collection: treatment_summary
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  subSection: { marginTop: 8, marginBottom: 8, marginLeft: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#858585' },
  subSectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* humanizeKey: object-key -> readable label */
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
/* flattenObject: recursive dynamic-key object -> [{ depth, label, value }] (value '' for parent headings) */
const flattenObject = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object') return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (isEmptyDeep(value)) return;
    const label = humanizeKey(key);
    if (value === null || typeof value !== 'object') {
      items.push({ depth, label, value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) });
    } else if (Array.isArray(value)) {
      const scalars = value.filter(v => v === null || typeof v !== 'object');
      const objs = value.filter(v => v && typeof v === 'object');
      if (scalars.length && !objs.length) {
        items.push({ depth, label, value: scalars.filter(v => !isEmptyDeep(v)).map(v => typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)).join(', ') });
      } else {
        items.push({ depth, label, value: '' });
        value.filter(v => !isEmptyDeep(v)).forEach((v, i) => {
          if (v && typeof v === 'object') { items.push({ depth: depth + 1, label: `${label} ${i + 1}`, value: '' }); items.push(...flattenObject(v, depth + 2)); }
          else items.push({ depth: depth + 1, label: `${label} ${i + 1}`, value: typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v) });
        });
      }
    } else {
      items.push({ depth, label, value: '' });
      items.push(...flattenObject(value, depth + 1));
    }
  });
  return items;
};

/* ======= COMPONENT ======= */
const TreatmentSummaryDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (!docProp) records = [];
  else if (Array.isArray(docProp)) {
    records = docProp.flatMap(r => {
      if (r?.treatment_summary) return Array.isArray(r.treatment_summary) ? r.treatment_summary : [r.treatment_summary];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.treatment_summary) return Array.isArray(dd.treatment_summary) ? dd.treatment_summary : [dd.treatment_summary]; return [dd]; }
      return [r];
    });
  } else {
    if (docProp.treatment_summary) records = Array.isArray(docProp.treatment_summary) ? docProp.treatment_summary : [docProp.treatment_summary];
    else records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Treatment Summary</Text>
          </View>
          <Text style={styles.noDataText}>No treatment summary data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Treatment Summary</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record header */}
            <View style={styles.recordHeader} wrap={false}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Treatment Summary {idx + 1}</Text>
            </View>

            {/* General Information */}
            {(hasVal(record.date) || hasVal(record.type) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>General Information</Text>
                  {hasVal(record.date) && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Date</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                    </View>
                  )}
                </View>
                {hasVal(record.type) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Type</Text>
                    <Text style={styles.fieldValue}>{safeString(record.type)}</Text>
                  </View>
                )}
                {hasVal(record.provider) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Provider</Text>
                    {record.provider.split(/;\s*/).map((p, pIdx) => (
                      <Text key={pIdx} style={styles.fieldValue}>{p.trim()}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.facility) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Facility</Text>
                    <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                  </View>
                )}
                {hasVal(record.status) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Status</Text>
                    <Text style={styles.fieldValue}>{safeString(record.status)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Primary Diagnosis */}
            {record.primaryDiagnosis && (hasVal(record.primaryDiagnosis.site) || hasVal(record.primaryDiagnosis.histology) || hasVal(record.primaryDiagnosis.dateOfDiagnosis) || hasVal(record.primaryDiagnosis.stageAtDiagnosis)) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Primary Diagnosis</Text>
                  {hasVal(record.primaryDiagnosis.site) && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Site</Text>
                      <Text style={styles.fieldValue}>{safeString(record.primaryDiagnosis.site)}</Text>
                    </View>
                  )}
                </View>
                {hasVal(record.primaryDiagnosis.histology) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Histology</Text>
                    <Text style={styles.fieldValue}>{safeString(record.primaryDiagnosis.histology)}</Text>
                  </View>
                )}
                {hasVal(record.primaryDiagnosis.dateOfDiagnosis) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Date of Diagnosis</Text>
                    <Text style={styles.fieldValue}>{safeString(record.primaryDiagnosis.dateOfDiagnosis)}</Text>
                  </View>
                )}
                {hasVal(record.primaryDiagnosis.stageAtDiagnosis) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Stage at Diagnosis</Text>
                    <Text style={styles.fieldValue}>{safeString(record.primaryDiagnosis.stageAtDiagnosis)}</Text>
                  </View>
                )}
                {record.primaryDiagnosis.tnmStaging && Object.keys(record.primaryDiagnosis.tnmStaging).length > 0 && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>TNM Staging</Text>
                    <Text style={styles.fieldValue}>
                      T: {record.primaryDiagnosis.tnmStaging.t || 'N/A'}, N: {record.primaryDiagnosis.tnmStaging.n || 'N/A'}, M: {record.primaryDiagnosis.tnmStaging.m || 'N/A'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Treatment Timeline */}
            {record.treatmentTimeline && record.treatmentTimeline.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Treatment Timeline</Text>
                  {record.treatmentTimeline.length > 0 && (() => {
                    const t = record.treatmentTimeline[0];
                    return (
                      <View style={styles.subSection}>
                        <Text style={styles.subSectionTitle}>{t.treatment || 'Treatment 1'}</Text>
                        {hasVal(t.startDate) && <Text style={styles.listItem}>Start Date: {t.startDate}</Text>}
                        {hasVal(t.endDate) && <Text style={styles.listItem}>End Date: {t.endDate}</Text>}
                        {hasVal(t.response) && (
                          <View>
                            <Text style={styles.listItem}>Response:</Text>
                            {splitBySentence(t.response).map((s, sIdx) => (
                              <Text key={sIdx} style={[styles.listItem, { marginLeft: 16 }]}>{s}</Text>
                            ))}
                          </View>
                        )}
                        {t.complications && t.complications.length > 0 && (
                          <Text style={styles.listItem}>Complications: {t.complications.join(', ')}</Text>
                        )}
                      </View>
                    );
                  })()}
                </View>
                {record.treatmentTimeline.slice(1).map((t, tIdx) => (
                  <View key={tIdx} style={styles.subSection}>
                    <Text style={styles.subSectionTitle}>{t.treatment || `Treatment ${tIdx + 2}`}</Text>
                    {hasVal(t.startDate) && <Text style={styles.listItem}>Start Date: {t.startDate}</Text>}
                    {hasVal(t.endDate) && <Text style={styles.listItem}>End Date: {t.endDate}</Text>}
                    {hasVal(t.response) && (
                      <View>
                        <Text style={styles.listItem}>Response:</Text>
                        {splitBySentence(t.response).map((s, sIdx) => (
                          <Text key={sIdx} style={[styles.listItem, { marginLeft: 16 }]}>{s}</Text>
                        ))}
                      </View>
                    )}
                    {t.complications && t.complications.length > 0 && (
                      <Text style={styles.listItem}>Complications: {t.complications.join(', ')}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Treatment Status */}
            {(hasVal(record.currentTreatmentStatus) || hasVal(record.diseaseStatus)) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Treatment Status</Text>
                  {hasVal(record.currentTreatmentStatus) && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Current Treatment Status</Text>
                      {splitBySentence(record.currentTreatmentStatus).map((s, sIdx) => (
                        <Text key={sIdx} style={styles.fieldValue}>{s}</Text>
                      ))}
                    </View>
                  )}
                </View>
                {hasVal(record.diseaseStatus) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Disease Status</Text>
                    {splitBySentence(record.diseaseStatus).map((s, sIdx) => (
                      <Text key={sIdx} style={styles.fieldValue}>{s}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Clinical Notes */}
            {(hasVal(record.findings) || hasVal(record.assessment) || hasVal(record.plan) || hasVal(record.notes)) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Clinical Notes</Text>
                  {hasVal(record.findings) && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Findings</Text>
                      {splitBySentence(record.findings).map((s, sIdx) => (
                        <Text key={sIdx} style={styles.fieldValue}>{s}</Text>
                      ))}
                    </View>
                  )}
                </View>
                {hasVal(record.assessment) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Assessment</Text>
                    {splitBySentence(record.assessment).map((s, sIdx) => (
                      <Text key={sIdx} style={styles.fieldValue}>{s}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.plan) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Plan</Text>
                    {splitBySentence(record.plan).map((s, sIdx) => (
                      <Text key={sIdx} style={styles.fieldValue}>{s}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.notes) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Notes</Text>
                    {splitBySentence(record.notes).map((s, sIdx) => (
                      <Text key={sIdx} style={styles.fieldValue}>{s}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Results (dynamic-key object) */}
            {record.results && typeof record.results === 'object' && !isEmptyDeep(record.results) && (() => {
              const resultItems = flattenObject(record.results);
              if (resultItems.length === 0) return null;
              return (
                <View style={styles.section} wrap={resultItems.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {resultItems.map((item, iIdx) => (
                    <Text key={iIdx} style={[styles.listItem, { paddingLeft: 8 + item.depth * 10 }]}>
                      {item.value === '' ? `${item.label}:` : `${item.label}: ${item.value}`}
                    </Text>
                  ))}
                </View>
              );
            })()}

            {/* Recommendations */}
            {record.recommendations && record.recommendations.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {record.recommendations.length > 0 && (() => {
                    const rec = record.recommendations[0];
                    return (
                      <View style={{ marginBottom: 4 }}>
                        {typeof rec === 'object' ? (
                          <>
                            {rec.date && <Text style={{ fontSize: 10, color: '#666666', marginBottom: 2 }}>{formatDate(rec.date)}</Text>}
                            <Text style={styles.listItem}>{rec.recommendation || 'N/A'}</Text>
                          </>
                        ) : (
                          <Text style={styles.listItem}>{safeString(rec)}</Text>
                        )}
                      </View>
                    );
                  })()}
                </View>
                {record.recommendations.slice(1).map((rec, rIdx) => (
                  <View key={rIdx} style={{ marginBottom: 4 }}>
                    {typeof rec === 'object' ? (
                      <>
                        {rec.date && <Text style={{ fontSize: 10, color: '#666666', marginBottom: 2 }}>{formatDate(rec.date)}</Text>}
                        <Text style={styles.listItem}>{rec.recommendation || 'N/A'}</Text>
                      </>
                    ) : (
                      <Text style={styles.listItem}>{safeString(rec)}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Separator between records */}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TreatmentSummaryDocumentPDFTemplate;
