/**
 * PreconceptionCounselingDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — preconception counseling
 * Collection: preconception_counseling
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
  metaItem: { fontSize: 10, color: '#6b7280', marginRight: 16 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
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

/* Humanize a dynamic results key: Total_Bilirubin -> "Total Bilirubin" */
const humanizeKey = (key) => String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());

/* Recursively flatten a dynamic-key results object into { label, value } rows.
   Handles nested objects (label prefixed), arrays, and skips empty values. */
const flattenResults = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const rows = [];
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    const label = prefix ? `${prefix} - ${humanizeKey(k)}` : humanizeKey(k);
    if (v === null || v === undefined || v === '') return;
    if (typeof v === 'object' && !Array.isArray(v) && !v.$date) {
      rows.push(...flattenResults(v, label));
    } else if (Array.isArray(v)) {
      const joined = v.filter((x) => x !== null && x !== undefined && x !== '').map((x) => safeString(x)).join(', ');
      if (joined) rows.push({ label, value: joined });
    } else {
      rows.push({ label, value: safeString(v) });
    }
  });
  return rows;
};

const PreconceptionCounselingDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.preconception_counseling && Array.isArray(data.preconception_counseling)) {
    records = data.preconception_counseling;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.preconception_counseling) {
      records = Array.isArray(docData.preconception_counseling) ? docData.preconception_counseling : [docData.preconception_counseling];
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No preconception counseling records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Preconception Counseling</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
                {hasVal(record.status) && <Text style={styles.recordDate}>Status: {record.status}</Text>}
              </View>
              <Text style={styles.recordTitle}>Preconception Counseling {idx + 1}</Text>
            </View>

            {/* Meta badges */}
            <View style={styles.metaRow}>
              {record.planning && <Text style={styles.metaItem}>Planning</Text>}
              {record.geneticCounseling && <Text style={styles.metaItem}>Genetic Counseling</Text>}
            </View>

            {/* 1. Provider Information */}
            {(hasVal(record.provider) || hasVal(record.facility)) && (
              <View style={styles.section} minPresenceAhead={80}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Provider Information</Text>
                  {hasVal(record.provider) && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Provider</Text>
                      <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                    </View>
                  )}
                </View>
                {hasVal(record.facility) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Facility</Text>
                    <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* 2. Preconception Status */}
            {(hasVal(record.planning) || hasVal(record.targetHbA1c) || hasVal(record.contraceptionDiscussed) || hasVal(record.geneticCounseling)) && (
              <View style={styles.section} minPresenceAhead={80}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Preconception Status</Text>
                  {hasVal(record.planning) && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Planning</Text>
                      <Text style={styles.fieldValue}>{record.planning ? 'Yes' : 'No'}</Text>
                    </View>
                  )}
                </View>
                {hasVal(record.targetHbA1c) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Target HbA1c</Text>
                    <Text style={styles.fieldValue}>{safeString(record.targetHbA1c)}</Text>
                  </View>
                )}
                {hasVal(record.contraceptionDiscussed) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Contraception Discussed</Text>
                    <Text style={styles.fieldValue}>{record.contraceptionDiscussed ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                {hasVal(record.geneticCounseling) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Genetic Counseling</Text>
                    <Text style={styles.fieldValue}>{record.geneticCounseling ? 'Offered/Discussed' : 'Not Discussed'}</Text>
                  </View>
                )}
              </View>
            )}

            {/* 3. Medication Adjustments */}
            {record.medicationAdjustments?.length > 0 && (() => {
              const meds = record.medicationAdjustments;
              return (
                <View style={styles.section} minPresenceAhead={80}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Medication Adjustments</Text>
                    <View style={styles.fieldBox}>
                      <Text style={styles.nestedSubtitle}>{safeString(meds[0].medication || meds[0].name || '')}</Text>
                      <Text style={styles.fieldValue}>{safeString(meds[0].change || meds[0].action || meds[0].adjustment || '')}</Text>
                    </View>
                  </View>
                  {meds.slice(1).map((med, mIdx) => (
                    <View key={mIdx} style={styles.fieldBox}>
                      <Text style={styles.nestedSubtitle}>{safeString(med.medication || med.name || '')}</Text>
                      <Text style={styles.fieldValue}>{safeString(med.change || med.action || med.adjustment || '')}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* 4. Folic Acid */}
            {hasVal(record.folicAcidDose) && (
              <View style={styles.section} minPresenceAhead={80}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Folic Acid</Text>
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Dose</Text>
                    <Text style={styles.fieldValue}>{safeString(record.folicAcidDose)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 5. Risks Discussed */}
            {record.risksDiscussed?.length > 0 && (() => {
              const risks = record.risksDiscussed;
              return (
                <View style={styles.section} minPresenceAhead={80}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Risks Discussed</Text>
                    <Text style={styles.listItem}>1. {safeString(risks[0])}</Text>
                  </View>
                  {risks.slice(1).map((risk, rIdx) => (
                    <Text key={rIdx} style={styles.listItem}>{rIdx + 2}. {safeString(risk)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* 6. Findings */}
            {hasVal(record.findings) && (() => {
              const items = splitBySentence(record.findings);
              if (items.length === 0) return null;
              return (
                <View style={styles.section} minPresenceAhead={80}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    <Text style={styles.listItem}>1. {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>{itemIdx + 2}. {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* 7. Assessment */}
            {hasVal(record.assessment) && (() => {
              const items = splitBySentence(record.assessment);
              if (items.length === 0) return null;
              return (
                <View style={styles.section} minPresenceAhead={80}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Assessment</Text>
                    <Text style={styles.listItem}>1. {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>{itemIdx + 2}. {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* 8. Plan */}
            {hasVal(record.plan) && (() => {
              const items = splitBySentence(record.plan);
              if (items.length === 0) return null;
              return (
                <View style={styles.section} minPresenceAhead={80}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Plan</Text>
                    <Text style={styles.listItem}>1. {items[0]}</Text>
                  </View>
                  {items.slice(1).map((item, itemIdx) => (
                    <Text key={itemIdx} style={styles.listItem}>{itemIdx + 2}. {item}</Text>
                  ))}
                </View>
              );
            })()}

            {/* 9. Recommendations */}
            {record.recommendations?.length > 0 && (() => {
              const recs = record.recommendations;
              const firstRec = recs[0];
              const firstRecText = typeof firstRec === 'string' ? firstRec : safeString(firstRec.recommendation);
              const firstRecDate = typeof firstRec === 'object' && firstRec.date ? formatDate(firstRec.date) : null;
              return (
                <View style={styles.section} minPresenceAhead={80}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {firstRecDate && <Text style={styles.recordDate}>{firstRecDate}</Text>}
                    <Text style={styles.listItem}>1. {firstRecText}</Text>
                  </View>
                  {recs.slice(1).map((rec, recIdx) => {
                    const recText = typeof rec === 'string' ? rec : safeString(rec.recommendation);
                    const recDate = typeof rec === 'object' && rec.date ? formatDate(rec.date) : null;
                    return (
                      <View key={recIdx}>
                        {recDate && <Text style={styles.recordDate}>{recDate}</Text>}
                        <Text style={styles.listItem}>{recIdx + 2}. {recText}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* 10. Results (dynamic-key object, recursively flattened) */}
            {(() => {
              const rows = flattenResults(record.results);
              if (rows.length === 0) return null;
              return (
                <View style={styles.section} wrap={rows.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {rows.map((r, rIdx) => (
                    <View key={rIdx} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{r.label}</Text>
                      <Text style={styles.fieldValue}>{r.value}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* 11. Notes */}
            {hasVal(record.notes) && (
              <View style={styles.section} minPresenceAhead={80}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.fieldValue}>{safeString(record.notes)}</Text>
                </View>
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

export default PreconceptionCounselingDocumentPDFTemplate;
