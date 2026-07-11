/**
 * PsychiatricEvaluationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — psychiatric evaluations
 * Collection: psychiatric_evaluations
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
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/[\u03BC\u00B5]m/g, 'um');
  str = str.replace(/\u00B0/g, ' deg');
  str = str.replace(/\u00B1/g, '+/-');
  str = str.replace(/\u2265/g, '>=');
  str = str.replace(/\u2264/g, '<=');
  str = str.replace(/\u2192/g, '->');
  return str;
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
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

const SUBFIELD_LABELS = {
  previousDiagnoses: 'Previous Diagnoses', diagnoses: 'Diagnoses', previousEpisodes: 'Previous Episodes',
  hospitalizations: 'Hospitalizations', priorHospitalizations: 'Prior Hospitalizations',
  previousMedications: 'Previous Medications', previousTherapy: 'Previous Therapy', therapy: 'Therapy',
  suicideAttempts: 'Suicide Attempts', priorAttempts: 'Prior Attempts', selfHarm: 'Self-Harm', substanceAbuse: 'Substance Abuse',
  alcohol: 'Alcohol', tobacco: 'Tobacco', cannabis: 'Cannabis', marijuana: 'Marijuana', drugs: 'Drugs',
  illicitDrugs: 'Illicit Drugs', otherSubstances: 'Other Substances', substanceUseDisorder: 'Substance Use Disorder', current: 'Current',
  appearance: 'Appearance', behavior: 'Behavior', speech: 'Speech', mood: 'Mood', affect: 'Affect',
  thoughtProcess: 'Thought Process', thoughtContent: 'Thought Content', perceptions: 'Perceptions',
  cognition: 'Cognition', insight: 'Insight', judgment: 'Judgment',
  suicidalIdeation: 'Suicidal Ideation', currentSI: 'Current SI', intent: 'Intent', plan: 'Plan',
  homicidalIdeation: 'Homicidal Ideation', riskFactors: 'Risk Factors', protectiveFactors: 'Protective Factors',
  cssrs: 'C-SSRS', cssrsScore: 'C-SSRS Score', ingestionAssessment: 'Ingestion Assessment', priorAttempt: 'Prior Attempt', riskLevel: 'Risk Level',
  immediateInterventions: 'Immediate Interventions', medications: 'Medications', pharmacological: 'Pharmacological',
  psychotherapy: 'Psychotherapy', psychosocialInterventions: 'Psychosocial Interventions', supportGroups: 'Support Groups',
  lifestyle: 'Lifestyle', recommendations: 'Recommendations', observation: 'Observation', labs: 'Labs',
  diagnostics: 'Diagnostics', disposition: 'Disposition', facility: 'Facility', followUp: 'Follow-Up',
};

const formatLabel = (key) => {
  if (!key) return '';
  if (SUBFIELD_LABELS[key]) return SUBFIELD_LABELS[key];
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
};

/* Preferred key ordering for dynamic-key object roots; unknown keys appended */
const PREFERRED_ORDER = {
  psychiatricHistory: ['previousDiagnoses', 'diagnoses', 'previousEpisodes', 'hospitalizations', 'priorHospitalizations', 'previousMedications', 'previousTherapy', 'therapy', 'suicideAttempts', 'priorAttempts', 'selfHarm', 'substanceAbuse'],
  substanceUseHistory: ['alcohol', 'tobacco', 'cannabis', 'marijuana', 'drugs', 'illicitDrugs', 'otherSubstances', 'substanceUseDisorder', 'current'],
  riskAssessment: ['suicidalIdeation', 'currentSI', 'intent', 'plan', 'homicidalIdeation', 'riskFactors', 'protectiveFactors', 'cssrs', 'cssrsScore', 'ingestionAssessment', 'priorAttempt', 'riskLevel'],
  treatmentPlan: ['immediateInterventions', 'medications', 'pharmacological', 'psychotherapy', 'psychosocialInterventions', 'supportGroups', 'lifestyle', 'recommendations', 'observation', 'labs', 'diagnostics', 'disposition', 'facility', 'followUp'],
};

/* Ordered keys present in a dynamic-key object */
const orderedKeys = (obj, root) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const actual = Object.keys(obj);
  const pref = PREFERRED_ORDER[root] || [];
  const ordered = pref.filter(k => actual.includes(k));
  actual.forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
  return ordered;
};

/* Render one dynamic subfield: string -> labeled value; array -> numbered list */
const renderSubField = (label, value, keyId) => {
  if (!hasVal(value)) return null;
  if (Array.isArray(value)) {
    return (
      <View key={keyId} style={styles.fieldBox}>
        <Text style={styles.nestedSubtitle}>{label}</Text>
        {value.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    );
  }
  return (
    <View key={keyId} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

/* ======= COMPONENT ======= */
const PsychiatricEvaluationsDocumentPDFTemplate = ({ document: docProp }) => {
  const unwrapData = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.records && Array.isArray(data.records)) return data.records;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [data];
  };

  const records = unwrapData(docProp);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Psychiatric Evaluations</Text>
          </View>
          <Text style={styles.noDataText}>No psychiatric evaluation data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Psychiatric Evaluations</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {record.date && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>
              <Text style={styles.recordTitle}>{safeString(record.psychiatrist || `Psychiatric Evaluation ${idx + 1}`)}</Text>
            </View>

            {/* Section 1: Record Information */}
            {hasVal(record.psychiatrist) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Record Information</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>Psychiatrist</Text>
                  <Text style={styles.fieldValue}>{safeString(record.psychiatrist)}</Text>
                </View>
              </View>
            )}

            {/* Section 2: Chief Complaint */}
            {hasVal(record.chiefComplaint) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Chief Complaint</Text>
                <Text style={styles.fieldValue}>{safeString(record.chiefComplaint)}</Text>
              </View>
            )}

            {/* Section 3: History of Present Illness */}
            {hasVal(record.historyOfPresentIllness) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>History of Present Illness</Text>
                {splitBySentence(record.historyOfPresentIllness).map((sentence, sIdx) => (
                  <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {safeString(sentence)}</Text>
                ))}
              </View>
            )}

            {/* Section 4: Psychiatric History (dynamic keys) */}
            {hasVal(record.psychiatricHistory) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Psychiatric History</Text>
                {orderedKeys(record.psychiatricHistory, 'psychiatricHistory').map(key =>
                  renderSubField(formatLabel(key), record.psychiatricHistory[key], `ph-${key}`)
                )}
              </View>
            )}

            {/* Section 5: Substance Use History (dynamic keys) */}
            {hasVal(record.substanceUseHistory) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Substance Use History</Text>
                {orderedKeys(record.substanceUseHistory, 'substanceUseHistory').map(key =>
                  renderSubField(formatLabel(key), record.substanceUseHistory[key], `su-${key}`)
                )}
              </View>
            )}

            {/* Section 6: Mental Status Exam */}
            {hasVal(record.mentalStatusExam) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mental Status Exam</Text>
                {['appearance', 'behavior', 'speech', 'mood', 'affect', 'thoughtProcess', 'thoughtContent', 'perceptions', 'cognition', 'insight', 'judgment'].map(field => {
                  const value = record.mentalStatusExam[field];
                  if (!hasVal(value)) return null;
                  return (
                    <View key={field} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{formatLabel(field)}</Text>
                      <Text style={styles.fieldValue}>{safeString(value)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Section 7: Risk Assessment (dynamic keys) */}
            {hasVal(record.riskAssessment) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Risk Assessment</Text>
                {orderedKeys(record.riskAssessment, 'riskAssessment').map(key =>
                  renderSubField(formatLabel(key), record.riskAssessment[key], `ra-${key}`)
                )}
              </View>
            )}

            {/* Section 8: Diagnosis */}
            {record.diagnosis?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Diagnosis</Text>
                {record.diagnosis.map((dx, dxIdx) => (
                  <Text key={dxIdx} style={styles.listItem}>{dxIdx + 1}. {safeString(dx)}</Text>
                ))}
              </View>
            )}

            {/* Section 9: Treatment Plan (dynamic keys; values may be array or string) */}
            {hasVal(record.treatmentPlan) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Treatment Plan</Text>
                {orderedKeys(record.treatmentPlan, 'treatmentPlan').map(key =>
                  renderSubField(formatLabel(key), record.treatmentPlan[key], `tp-${key}`)
                )}
              </View>
            )}

            {/* Section 10: Current Medications */}
            {record.medications?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Medications</Text>
                {record.medications.map((med, mIdx) => (
                  <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {safeString(med)}</Text>
                ))}
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PsychiatricEvaluationsDocumentPDFTemplate;
