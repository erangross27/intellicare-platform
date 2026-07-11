/**
 * PsychiatricTreatmentPlanDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — psychiatric treatment plan
 * Collection: psychiatric_treatment_plan
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1f2937', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldGroup: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
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
  if (typeof val === 'string') return val.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2013/g, '-').replace(/\u2014/g, '--').replace(/\u2026/g, '...').replace(/\u00A0/g, ' ');
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

const KEY_OVERRIDES = {};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return safeString(v ?? ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the Rule #74 wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* ======= COMPONENT ======= */
const PsychiatricTreatmentPlanDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (!docProp) records = [];
  else if (Array.isArray(docProp)) {
    records = docProp.flatMap(r => {
      if (r?.psychiatric_treatment_plan) return Array.isArray(r.psychiatric_treatment_plan) ? r.psychiatric_treatment_plan : [r.psychiatric_treatment_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_treatment_plan) return Array.isArray(dd.psychiatric_treatment_plan) ? dd.psychiatric_treatment_plan : [dd.psychiatric_treatment_plan]; return [dd]; }
      return [r];
    });
  } else {
    if (docProp.psychiatric_treatment_plan) records = Array.isArray(docProp.psychiatric_treatment_plan) ? docProp.psychiatric_treatment_plan : [docProp.psychiatric_treatment_plan];
    else if (docProp.documentData) { const dd = docProp.documentData; records = Array.isArray(dd) ? dd : [dd]; }
    else records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Psychiatric Treatment Plan</Text>
          </View>
          <Text style={styles.noDataText}>No psychiatric treatment plan records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Psychiatric Treatment Plan</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>
              <Text style={styles.recordTitle}>Treatment Plan {idx + 1}</Text>
            </View>

            {/* Plan Information */}
            {(hasVal(record.date) || hasVal(record.type) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plan Information</Text>
                {hasVal(record.date) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Date</Text><Text style={styles.fieldValue}>{formatDate(record.date)}</Text></View>}
                {hasVal(record.type) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Type</Text><Text style={styles.fieldValue}>{safeString(record.type)}</Text></View>}
                {hasVal(record.provider) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Provider</Text><Text style={styles.fieldValue}>{safeString(record.provider)}</Text></View>}
                {hasVal(record.facility) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Facility</Text><Text style={styles.fieldValue}>{safeString(record.facility)}</Text></View>}
                {hasVal(record.status) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Status</Text><Text style={styles.fieldValue}>{safeString(record.status)}</Text></View>}
              </View>
            )}

            {/* Diagnoses */}
            {record.diagnoses?.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Diagnoses</Text>
                  {record.diagnoses[0] && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.listItem}>1. {safeString(record.diagnoses[0].diagnosis)}</Text>
                      {hasVal(record.diagnoses[0].icdCode) && <Text style={[styles.listItem, { paddingLeft: 20 }]}>ICD Code: {safeString(record.diagnoses[0].icdCode)}</Text>}
                      {record.diagnoses[0].specifiers?.length > 0 && record.diagnoses[0].specifiers.map((spec, sIdx) => (
                        <Text key={sIdx} style={[styles.listItem, { paddingLeft: 20 }]}>Specifier: {safeString(spec)}</Text>
                      ))}
                    </View>
                  )}
                </View>
                {record.diagnoses.slice(1).map((diag, dIdx) => (
                  <View key={dIdx} style={styles.fieldBox}>
                    <Text style={styles.listItem}>{dIdx + 2}. {safeString(diag.diagnosis)}</Text>
                    {hasVal(diag.icdCode) && <Text style={[styles.listItem, { paddingLeft: 20 }]}>ICD Code: {safeString(diag.icdCode)}</Text>}
                    {diag.specifiers?.length > 0 && diag.specifiers.map((spec, sIdx) => (
                      <Text key={sIdx} style={[styles.listItem, { paddingLeft: 20 }]}>Specifier: {safeString(spec)}</Text>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {/* Findings */}
            {hasVal(record.findings) && (() => {
              const sentences = splitBySentence(safeString(record.findings));
              if (sentences.length > 1) {
                return (
                  <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Findings</Text>
                    {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {s}</Text>))}
                  </View>
                );
              }
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  <Text style={styles.fieldValue}>{safeString(record.findings)}</Text>
                </View>
              );
            })()}

            {/* Assessment */}
            {hasVal(record.assessment) && (() => {
              const sentences = splitBySentence(safeString(record.assessment));
              if (sentences.length > 1) {
                return (
                  <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Assessment</Text>
                    {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {s}</Text>))}
                  </View>
                );
              }
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  <Text style={styles.fieldValue}>{safeString(record.assessment)}</Text>
                </View>
              );
            })()}

            {/* Pharmacological Interventions */}
            {record.pharmacological?.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Pharmacological Interventions</Text>
                  {record.pharmacological[0] && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.listItem}>1. {safeString(record.pharmacological[0].intervention)}</Text>
                      {hasVal(record.pharmacological[0].rationale) && <Text style={[styles.listItem, { paddingLeft: 20 }]}>Rationale: {safeString(record.pharmacological[0].rationale)}</Text>}
                      {hasVal(record.pharmacological[0].monitoring) && <Text style={[styles.listItem, { paddingLeft: 20 }]}>Monitoring: {safeString(record.pharmacological[0].monitoring)}</Text>}
                    </View>
                  )}
                </View>
                {record.pharmacological.slice(1).map((med, mIdx) => (
                  <View key={mIdx} style={styles.fieldBox}>
                    <Text style={styles.listItem}>{mIdx + 2}. {safeString(med.intervention)}</Text>
                    {hasVal(med.rationale) && <Text style={[styles.listItem, { paddingLeft: 20 }]}>Rationale: {safeString(med.rationale)}</Text>}
                    {hasVal(med.monitoring) && <Text style={[styles.listItem, { paddingLeft: 20 }]}>Monitoring: {safeString(med.monitoring)}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Psychotherapy */}
            {record.psychotherapy && (hasVal(record.psychotherapy.type) || hasVal(record.psychotherapy.frequency) || hasVal(record.psychotherapy.provider) || record.psychotherapy.goals?.length > 0) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Psychotherapy</Text>
                  {hasVal(record.psychotherapy.type) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Type</Text><Text style={styles.fieldValue}>{safeString(record.psychotherapy.type)}</Text></View>}
                </View>
                {hasVal(record.psychotherapy.frequency) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Frequency</Text><Text style={styles.fieldValue}>{safeString(record.psychotherapy.frequency)}</Text></View>}
                {hasVal(record.psychotherapy.provider) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Provider</Text><Text style={styles.fieldValue}>{safeString(record.psychotherapy.provider)}</Text></View>}
                {record.psychotherapy.goals?.length > 0 && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Goals</Text>
                    {record.psychotherapy.goals.map((goal, gIdx) => (
                      <Text key={gIdx} style={styles.listItem}>{gIdx + 1}. {safeString(goal)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Support Groups */}
            {record.supportGroups?.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Support Groups</Text>
                  <Text style={styles.listItem}>1. {safeString(record.supportGroups[0])}</Text>
                </View>
                {record.supportGroups.slice(1).map((group, gIdx) => (
                  <Text key={gIdx} style={styles.listItem}>{gIdx + 2}. {safeString(group)}</Text>
                ))}
              </View>
            )}

            {/* Lifestyle Modifications */}
            {record.lifestyleModifications?.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Lifestyle Modifications</Text>
                  <Text style={styles.listItem}>1. {safeString(record.lifestyleModifications[0])}</Text>
                </View>
                {record.lifestyleModifications.slice(1).map((mod, mIdx) => (
                  <Text key={mIdx} style={styles.listItem}>{mIdx + 2}. {safeString(mod)}</Text>
                ))}
              </View>
            )}

            {/* Safety Plan */}
            {record.safetyPlan && (
              record.safetyPlan.warningSignsidentified?.length > 0 ||
              record.safetyPlan.copingStrategies?.length > 0 ||
              record.safetyPlan.supportsContacts?.length > 0 ||
              record.safetyPlan.crisisNumbers?.length > 0 ||
              record.safetyPlan.meansRestriction?.length > 0 ||
              hasVal(record.safetyPlan.childcarePlan)
            ) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Safety Plan</Text>
                  {record.safetyPlan.warningSignsidentified?.length > 0 && (
                    <View>
                      <Text style={styles.nestedSubtitle}>Warning Signs</Text>
                      {record.safetyPlan.warningSignsidentified.map((sign, sIdx) => (
                        <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {safeString(sign)}</Text>
                      ))}
                    </View>
                  )}
                </View>

                {record.safetyPlan.copingStrategies?.length > 0 && (
                  <View wrap={false}>
                    <Text style={styles.nestedSubtitle}>Coping Strategies</Text>
                    {record.safetyPlan.copingStrategies.map((strategy, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {safeString(strategy)}</Text>
                    ))}
                  </View>
                )}

                {record.safetyPlan.supportsContacts?.length > 0 && (
                  <View wrap={false}>
                    <Text style={styles.nestedSubtitle}>Support Contacts</Text>
                    {record.safetyPlan.supportsContacts.map((contact, cIdx) => (
                      <Text key={cIdx} style={styles.listItem}>{cIdx + 1}. {safeString(contact)}</Text>
                    ))}
                  </View>
                )}

                {record.safetyPlan.crisisNumbers?.length > 0 && (
                  <View wrap={false}>
                    <Text style={styles.nestedSubtitle}>Crisis Numbers</Text>
                    {record.safetyPlan.crisisNumbers.map((num, nIdx) => (
                      <Text key={nIdx} style={styles.listItem}>{nIdx + 1}. {safeString(num)}</Text>
                    ))}
                  </View>
                )}

                {record.safetyPlan.meansRestriction?.length > 0 && (
                  <View wrap={false}>
                    <Text style={styles.nestedSubtitle}>Means Restriction</Text>
                    {record.safetyPlan.meansRestriction.map((means, mIdx) => (
                      <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {safeString(means)}</Text>
                    ))}
                  </View>
                )}

                {hasVal(record.safetyPlan.childcarePlan) && (
                  <View wrap={false}>
                    <Text style={styles.nestedSubtitle}>Childcare Plan</Text>
                    <Text style={styles.fieldValue}>{safeString(record.safetyPlan.childcarePlan)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Follow-Up Plan */}
            {record.followUpPlan && (hasVal(record.followUpPlan.nextAppointment) || hasVal(record.followUpPlan.frequency) || record.followUpPlan.monitoring?.length > 0) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Follow-Up Plan</Text>
                  {hasVal(record.followUpPlan.nextAppointment) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Next Appointment</Text><Text style={styles.fieldValue}>{safeString(record.followUpPlan.nextAppointment)}</Text></View>}
                </View>
                {hasVal(record.followUpPlan.frequency) && <View style={styles.fieldBox}><Text style={styles.fieldLabel}>Frequency</Text><Text style={styles.fieldValue}>{safeString(record.followUpPlan.frequency)}</Text></View>}
                {record.followUpPlan.monitoring?.length > 0 && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Monitoring</Text>
                    {record.followUpPlan.monitoring.map((param, pIdx) => (
                      <Text key={pIdx} style={styles.listItem}>{pIdx + 1}. {safeString(param)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Results */}
            {record.results && !isScalar(record.results) && !isEmptyDeep(record.results) && (() => {
              const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
              if (entries.length === 0) return null;
              return (
                <View style={styles.section}>
                  {entries.map(([k, v], i) => {
                    const rows = countRows(v);
                    return (
                      <View key={`results-${k}`} style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
                        {i === 0 ? <Text style={styles.sectionTitle}>Results</Text> : null}
                        {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Recommendations */}
            {Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0 && (() => {
              const recs = record.recommendations.filter(r => !isEmptyDeep(r));
              const groups = [];
              recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
              return (
                <View style={styles.section} wrap={recs.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {groups.map((group, gIdx) => (
                    <View key={gIdx}>
                      {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
                      {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {safeString(r?.recommendation)}</Text>))}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Plan */}
            {hasVal(record.plan) && (() => {
              const sentences = splitBySentence(safeString(record.plan));
              if (sentences.length > 1) {
                return (
                  <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Plan</Text>
                    {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {s}</Text>))}
                  </View>
                );
              }
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  <Text style={styles.fieldValue}>{safeString(record.plan)}</Text>
                </View>
              );
            })()}

            {/* Notes */}
            {hasVal(record.notes) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.fieldValue}>{safeString(record.notes)}</Text>
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PsychiatricTreatmentPlanDocumentPDFTemplate;
