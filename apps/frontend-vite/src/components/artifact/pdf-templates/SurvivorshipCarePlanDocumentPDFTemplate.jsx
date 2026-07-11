/**
 * SurvivorshipCarePlanDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- survivorship care plan
 * Collection: survivorship_care_plan
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedBlock: { marginLeft: 12, marginTop: 6, marginBottom: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#e2e8f0' },
  nestedTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#3a3a3a', marginBottom: 4 },
  nestedLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#6b7280', marginBottom: 2 },
  nestedValue: { fontSize: 12, lineHeight: 1.4, color: '#3a3a3a', marginBottom: 4 },
  subSection: { marginTop: 8, marginBottom: 8, paddingLeft: 8 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#3a3a3a', marginBottom: 6 },
  objLeafLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#444444', marginBottom: 1 },
  objLeafValue: { fontSize: 11, lineHeight: 1.4, color: '#000000', marginBottom: 4 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    if (dateVal.$date) return new Date(dateVal.$date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (dateVal instanceof Date) return dateVal.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return String(dateVal);
  } catch { return String(dateVal); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
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

const splitIntoSentences = (text) => {
  if (!text) return [];
  const textStr = safeString(text);
  const sentences = textStr.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Co|mg|kg|ml|mcg|ng|pg|mm|cm|oz|lb|lbs|yr|yrs|mo|wk|hr|min|sec|vol|no|pt|pts|approx|est|avg|max|min|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\.\s+/);
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
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

const isScalar = (v) => v === null || typeof v !== 'object';

/* recursive grayscale object renderer (results) — leaves + nested groups, hide-empty */
const renderObjectNodePDF = (value, label, keyPrefix) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPrefix} style={{ marginBottom: 4 }}>
        {label ? <Text style={styles.objLeafLabel}>{label}</Text> : null}
        <Text style={styles.objLeafValue}>{safeString(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPrefix} style={label ? styles.nestedBlock : undefined}>
      {label ? <Text style={styles.nestedTitle}>{label}</Text> : null}
      {entries.map(([k, v]) => renderObjectNodePDF(v, humanizeKey(k), `${keyPrefix}-${k}`))}
    </View>
  );
};

const SurvivorshipCarePlanDocumentPDFTemplate = ({ document: records }) => {
  let recordsArray = [];
  if (Array.isArray(records)) {
    recordsArray = records;
  } else if (records?.survivorship_care_plan && Array.isArray(records.survivorship_care_plan)) {
    recordsArray = records.survivorship_care_plan;
  } else if (records?.documentData) {
    const docData = records.documentData;
    if (Array.isArray(docData)) {
      recordsArray = docData;
    } else if (docData?.survivorship_care_plan && Array.isArray(docData.survivorship_care_plan)) {
      recordsArray = docData.survivorship_care_plan;
    } else if (docData && typeof docData === 'object') {
      recordsArray = [docData];
    }
  } else if (records && typeof records === 'object' && !Array.isArray(records)) {
    recordsArray = [records];
  }

  if (recordsArray.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No survivorship care plan records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Survivorship Care Plan</Text>
        </View>

        {recordsArray.map((record, idx) => {
          const fus = record.followUpSchedule || {};
          const hm = record.healthMaintenance || {};
          const ps = record.psychosocialSupport || {};

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader}>
                <View style={styles.recordDateRow}>
                  {record.date && <Text style={styles.recordDate}>Date: {formatDate(record.date)}</Text>}
                  {record.status && <Text style={styles.recordDate}>Status: {safeString(record.status)}</Text>}
                </View>
                <Text style={styles.recordTitle}>Survivorship Care Plan {idx + 1}</Text>
              </View>

              {/* Clinical Information */}
              {(record.provider || record.facility) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Clinical Information</Text>
                  {record.provider && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Provider</Text>
                      <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                    </View>
                  )}
                  {record.facility && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Facility</Text>
                      <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Follow-Up Schedule */}
              {(fus.clinicalExams || fus.imaging || fus.labWork) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Follow-Up Schedule</Text>
                  {fus.clinicalExams && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Clinical Exams</Text>
                      <Text style={styles.fieldValue}>{safeString(fus.clinicalExams)}</Text>
                    </View>
                  )}
                  {fus.imaging && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Imaging</Text>
                      <Text style={styles.fieldValue}>{safeString(fus.imaging)}</Text>
                    </View>
                  )}
                  {fus.labWork && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Lab Work</Text>
                      <Text style={styles.fieldValue}>{safeString(fus.labWork)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Surveillance Tests */}
              {Array.isArray(record.surveillanceTests) && record.surveillanceTests.length > 0 && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Surveillance Tests</Text>
                    <View style={styles.nestedBlock}>
                      <Text style={styles.nestedTitle}>{safeString(record.surveillanceTests[0].test)}</Text>
                      {record.surveillanceTests[0].frequency && <Text style={styles.nestedValue}>Frequency: {safeString(record.surveillanceTests[0].frequency)}</Text>}
                      {record.surveillanceTests[0].lastPerformed && <Text style={styles.nestedValue}>Last Performed: {safeString(record.surveillanceTests[0].lastPerformed)}</Text>}
                      {record.surveillanceTests[0].nextDue && <Text style={styles.nestedValue}>Next Due: {safeString(record.surveillanceTests[0].nextDue)}</Text>}
                    </View>
                  </View>
                  {record.surveillanceTests.slice(1).map((test, testIdx) => (
                    <View key={testIdx} style={styles.nestedBlock}>
                      <Text style={styles.nestedTitle}>{safeString(test.test)}</Text>
                      {test.frequency && <Text style={styles.nestedValue}>Frequency: {safeString(test.frequency)}</Text>}
                      {test.lastPerformed && <Text style={styles.nestedValue}>Last Performed: {safeString(test.lastPerformed)}</Text>}
                      {test.nextDue && <Text style={styles.nestedValue}>Next Due: {safeString(test.nextDue)}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* Late Effects Monitoring */}
              {Array.isArray(record.lateEffectsMonitoring) && record.lateEffectsMonitoring.length > 0 && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Late Effects Monitoring</Text>
                    <Text style={styles.listItem}>1. {safeString(record.lateEffectsMonitoring[0])}</Text>
                  </View>
                  {record.lateEffectsMonitoring.slice(1).map((effect, eIdx) => (
                    <Text key={eIdx} style={styles.listItem}>{eIdx + 2}. {safeString(effect)}</Text>
                  ))}
                </View>
              )}

              {/* Health Maintenance */}
              {(hm.vaccinations?.length > 0 || hm.screenings?.length > 0 || hm.lifestyle?.length > 0) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Health Maintenance</Text>

                  {Array.isArray(hm.vaccinations) && hm.vaccinations.length > 0 && (
                    <View style={styles.subSection}>
                      <View wrap={false}>
                        <Text style={styles.subSectionTitle}>Vaccinations</Text>
                        <Text style={styles.listItem}>1. {safeString(hm.vaccinations[0])}</Text>
                      </View>
                      {hm.vaccinations.slice(1).map((vacc, vIdx) => (
                        <Text key={vIdx} style={styles.listItem}>{vIdx + 2}. {safeString(vacc)}</Text>
                      ))}
                    </View>
                  )}

                  {Array.isArray(hm.screenings) && hm.screenings.length > 0 && (
                    <View style={styles.subSection}>
                      <View wrap={false}>
                        <Text style={styles.subSectionTitle}>Screenings</Text>
                        <View style={styles.nestedBlock}>
                          <Text style={styles.nestedTitle}>{safeString(hm.screenings[0].screening)}</Text>
                          {hm.screenings[0].dueDate && <Text style={styles.nestedValue}>Due Date: {safeString(hm.screenings[0].dueDate)}</Text>}
                          {hm.screenings[0].specialInstructions && <Text style={styles.nestedValue}>Instructions: {safeString(hm.screenings[0].specialInstructions)}</Text>}
                        </View>
                      </View>
                      {hm.screenings.slice(1).map((scr, sIdx) => (
                        <View key={sIdx} style={styles.nestedBlock}>
                          <Text style={styles.nestedTitle}>{safeString(scr.screening)}</Text>
                          {scr.dueDate && <Text style={styles.nestedValue}>Due Date: {safeString(scr.dueDate)}</Text>}
                          {scr.specialInstructions && <Text style={styles.nestedValue}>Instructions: {safeString(scr.specialInstructions)}</Text>}
                        </View>
                      ))}
                    </View>
                  )}

                  {Array.isArray(hm.lifestyle) && hm.lifestyle.length > 0 && (
                    <View style={styles.subSection}>
                      <View wrap={false}>
                        <Text style={styles.subSectionTitle}>Lifestyle</Text>
                        <Text style={styles.listItem}>1. {safeString(hm.lifestyle[0])}</Text>
                      </View>
                      {hm.lifestyle.slice(1).map((life, lIdx) => (
                        <Text key={lIdx} style={styles.listItem}>{lIdx + 2}. {safeString(life)}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Recurrence Signs */}
              {Array.isArray(record.recurrenceSigns) && record.recurrenceSigns.length > 0 && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Recurrence Signs</Text>
                    <Text style={styles.listItem}>1. {safeString(record.recurrenceSigns[0])}</Text>
                  </View>
                  {record.recurrenceSigns.slice(1).map((sign, sIdx) => (
                    <Text key={sIdx} style={styles.listItem}>{sIdx + 2}. {safeString(sign)}</Text>
                  ))}
                </View>
              )}

              {/* Surveillance Strategy */}
              {record.surveillanceStrategy && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Surveillance Strategy</Text>
                  <Text style={styles.fieldValue}>{safeString(record.surveillanceStrategy)}</Text>
                </View>
              )}

              {/* Findings */}
              {record.findings && (() => {
                const findingsSentences = splitIntoSentences(record.findings);
                return (
                  <View style={styles.section} wrap={findingsSentences.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    {findingsSentences.map((sentence, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence + (sentence.endsWith('.') ? '' : '.')}</Text>
                    ))}
                  </View>
                );
              })()}

              {/* Assessment */}
              {record.assessment && (() => {
                const assessmentSentences = splitIntoSentences(record.assessment);
                return (
                  <View style={styles.section} wrap={assessmentSentences.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Assessment</Text>
                    {assessmentSentences.map((sentence, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence + (sentence.endsWith('.') ? '' : '.')}</Text>
                    ))}
                  </View>
                );
              })()}

              {/* Plan */}
              {record.plan && (() => {
                const planSentences = splitIntoSentences(record.plan);
                return (
                  <View style={styles.section}>
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>Plan</Text>
                      {planSentences.length > 0 && <Text style={styles.listItem}>1. {planSentences[0] + (planSentences[0].endsWith('.') ? '' : '.')}</Text>}
                    </View>
                    {planSentences.slice(1).map((sentence, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>{sIdx + 2}. {sentence + (sentence.endsWith('.') ? '' : '.')}</Text>
                    ))}
                  </View>
                );
              })()}

              {/* Recommendations (array of {recommendation, date}, date-grouped) */}
              {Array.isArray(record.recommendations) && record.recommendations.filter(r => r && (r.recommendation || '').trim()).length > 0 && (() => {
                const recs = record.recommendations.filter(r => r && (r.recommendation || '').trim());
                const groups = [];
                recs.forEach((rec) => {
                  const d = (rec.date || '').trim();
                  const last = groups[groups.length - 1];
                  if (last && last.date === d) last.items.push(rec);
                  else groups.push({ date: d, items: [rec] });
                });
                return (
                  <View style={styles.section} wrap={recs.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {groups.map((group, gIdx) => (
                      <View key={gIdx} style={styles.subSection}>
                        {group.date ? <Text style={styles.subSectionTitle}>{safeString(group.date)}</Text> : null}
                        {group.items.map((rec, rIdx) => (
                          <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {safeString(rec.recommendation)}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Results (recursive object) */}
              {!isEmptyDeep(record.results) && typeof record.results === 'object' && !Array.isArray(record.results) && (() => {
                const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
                return (
                  <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Results</Text>
                    {entries.map(([k, v]) => renderObjectNodePDF(v, humanizeKey(k), `results-${k}`))}
                  </View>
                );
              })()}

              {/* Psychosocial Support */}
              {(ps.supportSystems?.length > 0 || ps.workStatus || ps.peerMentorInterest || ps.patientMotivation) && (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Psychosocial Support</Text>
                    {Array.isArray(ps.supportSystems) && ps.supportSystems.length > 0 && (
                      <View style={styles.fieldBox}>
                        <Text style={styles.fieldLabel}>Support Systems</Text>
                        <Text style={styles.fieldValue}>{ps.supportSystems.join(', ')}</Text>
                      </View>
                    )}
                  </View>
                  {ps.workStatus && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Work Status</Text>
                      <Text style={styles.fieldValue}>{safeString(ps.workStatus)}</Text>
                    </View>
                  )}
                  {ps.peerMentorInterest && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Peer Mentor Interest</Text>
                      <Text style={styles.fieldValue}>{safeString(ps.peerMentorInterest)}</Text>
                    </View>
                  )}
                  {ps.patientMotivation && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Patient Motivation</Text>
                      <Text style={styles.fieldValue}>{safeString(ps.patientMotivation)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Notes */}
              {record.notes && (() => {
                const notesSentences = splitIntoSentences(record.notes);
                return (
                  <View style={styles.section}>
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>Notes</Text>
                      {notesSentences.length > 0 && <Text style={styles.listItem}>1. {notesSentences[0] + (notesSentences[0].endsWith('.') ? '' : '.')}</Text>}
                    </View>
                    {notesSentences.slice(1).map((sentence, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>{sIdx + 2}. {sentence + (sentence.endsWith('.') ? '' : '.')}</Text>
                    ))}
                  </View>
                );
              })()}

              {idx < recordsArray.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default SurvivorshipCarePlanDocumentPDFTemplate;
