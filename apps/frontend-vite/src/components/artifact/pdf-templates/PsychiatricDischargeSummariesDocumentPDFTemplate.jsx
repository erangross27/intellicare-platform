/**
 * PsychiatricDischargeSummariesDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: psychiatric_discharge_summaries
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 11, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, marginBottom: 2 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#555555', marginBottom: 1, marginLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; const result = []; let current = ''; let inQuote = false; for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '"' || ch === '\u201C' || ch === '\u201D') { const wasInQuote = inQuote; inQuote = !inQuote; current += ch; if (wasInQuote && !inQuote && current.length >= 2 && current[current.length - 2] === '.' && i + 1 < text.length && /\s/.test(text[i + 1])) { const t2 = current.trim(); if (t2 && !/^[;.,!?]+$/.test(t2)) result.push(t2); current = ''; } continue; } if (ch === '.' && !inQuote && i + 1 < text.length && /\s/.test(text[i + 1])) { const before = current.trim().split(/\s+/).pop() || ''; if (/^(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i.test(before)) { current += ch; continue; } const t = current.trim(); if (t && !/^[;.,!?]+$/.test(t)) result.push(t); current = ''; } else { current += ch; } } const t = current.trim(); if (t && !/^[;.,!?]+$/.test(t)) result.push(t); return result; };
const parseLabel = (s) => { const m = s.replace(/[;.]+$/, '').trim().match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s); return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: s }; };
const renderFieldRow = (label, value) => { if (!hasVal(value)) return null; return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>); };
const prettifyKey = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;
  let totalItems = sentences.length;
  sentences.forEach(s => { const p = parseLabel(s); const rv = p.label ? p.value : s; const ci = rv.split(/[,;]\s+/).filter(x => x.trim()); if (ci.length > 1) totalItems += ci.length - 1; });
  let counter = 1;
  return (<View style={styles.fieldBox} wrap={totalItems > 8 ? undefined : false}>
    {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
    <Text style={styles.fieldLabel}>{label}</Text>
    {sentences.map((s, i) => {
      const p = parseLabel(s);
      const rawVal = p.label ? p.value : s.replace(/[;.]+$/, '').trim();
      // Quote-aware comma/semicolon split
      const cItems = (() => { const r2 = []; let c2 = ''; let q2 = false; for (let j = 0; j < rawVal.length; j++) { const cc = rawVal[j]; if (cc === '"') { q2 = !q2; c2 += cc; } else if ((cc === ',' || cc === ';') && !q2 && /\s/.test(rawVal[j+1] || '')) { const tt = c2.trim(); if (tt) r2.push(tt); c2 = ''; } else { c2 += cc; } } const tt = c2.trim(); if (tt) r2.push(tt); return r2.length > 0 ? r2 : [rawVal]; })();
      return (<View key={i} style={{ marginBottom: 3, marginLeft: 8 }}>
        {p.label && <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{p.label}</Text>}
        {cItems.length > 1 ? cItems.map((item, ci) => <Text key={ci} style={styles.listItem}>{counter++}. {item.trim()}</Text>) : <Text style={styles.listItem}>{counter++}. {rawVal}</Text>}
      </View>);
    })}
  </View>);
};

const PsychiatricDischargeSummariesDocumentPDFTemplate = ({ document: data }) => {
  /* Handle data unwrapping */
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.psychiatric_discharge_summaries && Array.isArray(data.psychiatric_discharge_summaries)) {
    records = data.psychiatric_discharge_summaries;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.psychiatric_discharge_summaries) {
      records = docData.psychiatric_discharge_summaries;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Psychiatric Discharge Summary</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Psychiatric Discharge Summary</Text></View>
        {records.map((record, idx) => {
          let counter = 1;
          return (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Psychiatric Discharge Summary ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* 1. Admission Information */}
            {(hasVal(record.admissionDate) || hasVal(record.dischargeDate) || hasVal(record.legalStatus) || hasVal(record.dischargeDisposition)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Admission Information</Text>
                {hasVal(record.admissionDate) && renderFieldRow('Admission Date', formatDate(record.admissionDate))}
                {hasVal(record.dischargeDate) && renderFieldRow('Discharge Date', formatDate(record.dischargeDate))}
                {renderSentenceField('Legal Status', record.legalStatus)}
                {renderSentenceField('Discharge Disposition', record.dischargeDisposition)}
              </View>
            )}

            {/* 2. Presentation */}
            {(hasVal(record.presentingComplaint) || (Array.isArray(record.precipitatingFactors) && record.precipitatingFactors.length > 0) || (Array.isArray(record.psychoticSymptoms) && record.psychoticSymptoms.length > 0)) && (
              <View style={styles.section}>
                {renderSentenceField('Presenting Complaint', record.presentingComplaint, 'Presentation')}
                {Array.isArray(record.precipitatingFactors) && record.precipitatingFactors.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.precipitatingFactors.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Precipitating Factors</Text>
                    {record.precipitatingFactors.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.psychoticSymptoms) && record.psychoticSymptoms.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.psychoticSymptoms.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Psychotic Symptoms</Text>
                    {record.psychoticSymptoms.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 3. Diagnoses */}
            {(hasVal(record.primaryDiagnosis) || (Array.isArray(record.secondaryDiagnoses) && record.secondaryDiagnoses.length > 0)) && (
              <View style={styles.section}>
                {renderSentenceField('Primary Diagnosis', record.primaryDiagnosis, 'Diagnoses')}
                {Array.isArray(record.secondaryDiagnoses) && record.secondaryDiagnoses.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.secondaryDiagnoses.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Secondary Diagnoses</Text>
                    {record.secondaryDiagnoses.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 4. Clinical Assessment */}
            {(hasVal(record.suicidalIdeation) || hasVal(record.homicidalIdeation) || hasVal(record.mentalStatusExamAtDischarge) || hasVal(record.riskAssessmentAtDischarge)) && (
              <View style={styles.section}>
                {renderSentenceField('Suicidal Ideation', record.suicidalIdeation, 'Clinical Assessment')}
                {renderSentenceField('Homicidal Ideation', record.homicidalIdeation)}
                {hasVal(record.mentalStatusExamAtDischarge) && typeof record.mentalStatusExamAtDischarge === 'object' && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Mental Status Exam at Discharge</Text>
                    {Object.entries(record.mentalStatusExamAtDischarge).filter(([, v]) => hasVal(v)).map(([k, v]) => (
                      <View key={k} style={{ marginBottom: 3, marginLeft: 8 }}>
                        <Text style={styles.subLabel}>{prettifyKey(k)}</Text>
                        <Text style={{ ...styles.fieldValue, marginLeft: 8 }}>{String(v)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {hasVal(record.riskAssessmentAtDischarge) && typeof record.riskAssessmentAtDischarge === 'object' && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>Risk Assessment at Discharge</Text>
                    {Object.entries(record.riskAssessmentAtDischarge).filter(([, v]) => hasVal(v)).map(([k, v]) => (
                      <View key={k} style={{ marginBottom: 3, marginLeft: 8 }}>
                        <Text style={styles.subLabel}>{prettifyKey(k)}</Text>
                        <Text style={{ ...styles.fieldValue, marginLeft: 8 }}>{String(v)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 5. Treatment */}
            {(hasVal(record.therapeuticInterventions) || hasVal(record.dischargeMedications) || hasVal(record.medicationChanges) || hasVal(record.treatmentCompliance) || hasVal(record.restraintSeclusionEvents)) && (
              <View style={styles.section}>
                {Array.isArray(record.therapeuticInterventions) && record.therapeuticInterventions.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.therapeuticInterventions.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Treatment</Text>
                    <Text style={styles.fieldLabel}>Therapeutic Interventions</Text>
                    {record.therapeuticInterventions.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.dischargeMedications) && record.dischargeMedications.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.dischargeMedications.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Discharge Medications</Text>
                    {record.dischargeMedications.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.medicationChanges) && record.medicationChanges.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.medicationChanges.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Medication Changes</Text>
                    {record.medicationChanges.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {renderSentenceField('Treatment Compliance', record.treatmentCompliance)}
                {Array.isArray(record.restraintSeclusionEvents) && record.restraintSeclusionEvents.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.restraintSeclusionEvents.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Restraint/Seclusion Events</Text>
                    {record.restraintSeclusionEvents.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 6. Substance Use History */}
            {hasVal(record.substanceUseHistory) && typeof record.substanceUseHistory === 'object' && (
              <View style={styles.section}>
                {(() => { const entries = Object.entries(record.substanceUseHistory).filter(([, v]) => hasVal(v)); return entries.length > 0 ? <View style={styles.fieldBox} wrap={entries.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Substance Use History</Text>{entries.map(([k, v]) => (
                  <View key={k} style={{ marginBottom: 4, marginLeft: 8 }}>
                    <Text style={styles.subLabel}>{prettifyKey(k)}</Text>
                    <Text style={{ ...styles.fieldValue, marginLeft: 8 }}>{String(v)}</Text>
                  </View>
                ))}</View> : null; })()}
              </View>
            )}

            {/* 7. Discharge Safety Plan */}
            {hasVal(record.dischargeSafetyPlan) && typeof record.dischargeSafetyPlan === 'object' && (
              <View style={styles.section}>
                {(() => { let first = true; return Object.entries(record.dischargeSafetyPlan).filter(([, v]) => hasVal(v)).map(([k, v]) => {
                  const showTitle = first; first = false;
                  if (Array.isArray(v) && v.length > 0) {
                    return (
                      <View key={k} style={styles.fieldBox} wrap={v.length > 8 ? undefined : false}>
                        {showTitle && <Text style={styles.sectionTitle}>Discharge Safety Plan</Text>}
                        <Text style={styles.subLabel}>{prettifyKey(k)}</Text>
                        {v.filter(Boolean).map((item, i) => (
                          <Text key={i} style={{ ...styles.listItem, marginLeft: 16 }}>{i + 1}. {String(item)}</Text>
                        ))}
                      </View>
                    );
                  }
                  return (
                    <View key={k} style={styles.fieldBox} wrap={false}>
                      {showTitle && <Text style={styles.sectionTitle}>Discharge Safety Plan</Text>}
                      <Text style={styles.subLabel}>{prettifyKey(k)}</Text>
                      <Text style={{ ...styles.fieldValue, marginLeft: 8 }}>{String(v)}</Text>
                    </View>
                  );
                }); })()}
              </View>
            )}

            {/* 8. Discharge Plan */}
            {(hasVal(record.aftercareArrangements) || hasVal(record.familyInvolvement) || hasVal(record.functionalStatus) || hasVal(record.insightAndJudgment)) && (
              <View style={styles.section}>
                {hasVal(record.aftercareArrangements) && typeof record.aftercareArrangements === 'object' && (
                  <View style={styles.fieldBox} wrap={Object.keys(record.aftercareArrangements).length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Discharge Plan</Text>
                    <Text style={styles.fieldLabel}>Aftercare Arrangements</Text>
                    {Object.entries(record.aftercareArrangements).filter(([, v]) => hasVal(v)).map(([k, v]) => (
                      <View key={k} style={{ marginBottom: 3, marginLeft: 8 }}>
                        <Text style={styles.subLabel}>{prettifyKey(k)}</Text>
                        <Text style={{ ...styles.fieldValue, marginLeft: 8 }}>{String(v)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {renderSentenceField('Family Involvement', record.familyInvolvement)}
                {renderSentenceField('Functional Status', record.functionalStatus)}
                {renderSentenceField('Insight and Judgment', record.insightAndJudgment)}
              </View>
            )}
          </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PsychiatricDischargeSummariesDocumentPDFTemplate;
