/**
 * SuicideRiskAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica, LETTER size, 20pt title / 12pt body
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μm/g, 'um').replace(/µm/g, 'um').replace(/°/g, ' deg').replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->');
  return str;
};

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try { const d = new Date(dateVal.$date || dateVal); if (isNaN(d.getTime())) return safeString(dateVal); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return safeString(dateVal); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return safeString(v); };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/* Flatten an object tree into [{label, value, depth}] leaf/branch rows (count for wrap-gating) */
const flattenObject = (obj, depth, out) => {
  Object.entries(obj).forEach(([k, v]) => {
    if (isEmptyDeep(v)) return;
    if (isScalar(v)) { out.push({ label: humanizeKey(k), value: fmtScalar(v), depth, leaf: true }); }
    else { out.push({ label: humanizeKey(k), value: null, depth, leaf: false }); flattenObject(v, depth + 1, out); }
  });
  return out;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 20, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 20, color: '#000000', textAlign: 'center' },
  recordContainer: { marginBottom: 24, paddingBottom: 16 },
  recordTitle: { fontSize: 16, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 8, color: '#000000' },
  recordMeta: { fontSize: 10, color: '#666666', marginBottom: 12 },
  riskLevelBadge: { fontSize: 12, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 12, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#000000', borderRadius: 4, alignSelf: 'flex-start' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', marginBottom: 6, color: '#000000', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3 },
  fieldBlock: { marginBottom: 6, marginLeft: 12 },
  fieldLabel: { fontSize: 10, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 12, color: '#000000', lineHeight: 1.4 },
  listItem: { fontSize: 12, color: '#000000', marginBottom: 3, marginLeft: 12 },
  booleanYes: { fontSize: 12, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', color: '#000000' },
  booleanNo: { fontSize: 12, color: '#666666' },
  objBranchLabel: { fontSize: 11, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 3, marginBottom: 2 },
  objLeafLabel: { fontSize: 10, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', color: '#000000' },
  objLeafValue: { fontSize: 12, color: '#000000', lineHeight: 1.4 },
});

const SuicideRiskAssessmentDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  const unwrapData = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.flatMap(item => {
        if (item?.suicide_risk_assessment) return Array.isArray(item.suicide_risk_assessment) ? item.suicide_risk_assessment : [item.suicide_risk_assessment];
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (input.suicide_risk_assessment) return Array.isArray(input.suicide_risk_assessment) ? input.suicide_risk_assessment : [input.suicide_risk_assessment];
    if (input.document) return Array.isArray(input.document) ? input.document : [input.document];
    if (input.data) return Array.isArray(input.data) ? input.data : [input.data];
    return [input];
  };

  const records = unwrapData(templateData);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Suicide Risk Assessment</Text>
          <Text style={{ textAlign: 'center', color: '#666666' }}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Suicide Risk Assessment</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <Text style={styles.recordTitle}>{safeString(`Assessment ${idx + 1}`)}</Text>
            <Text style={styles.recordMeta}>
              {hasValue(record.date) && `Date: ${formatDate(record.date)}`}
              {record.provider && ` | Provider: ${safeString(record.provider)}`}
              {record.facility && ` | Facility: ${safeString(record.facility)}`}
            </Text>

            {hasValue(record.riskLevel) && (
              <View style={styles.riskLevelBadge} wrap={false}>
                <Text>Risk Level: {safeString(record.riskLevel)}</Text>
              </View>
            )}

            {/* Ideation */}
            {hasValue(record.ideation) && (() => {
              const ideation = record.ideation;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Suicidal Ideation</Text>
                  {hasValue(ideation.current) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Current Status:</Text>
                      <Text style={styles.fieldValue}>{safeString(ideation.current)}</Text>
                    </View>
                  )}
                  {ideation.passive !== undefined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Passive Ideation:</Text>
                      <Text style={ideation.passive ? styles.booleanYes : styles.booleanNo}>{ideation.passive ? 'Yes' : 'No'}</Text>
                    </View>
                  )}
                  {ideation.active !== undefined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Active Ideation:</Text>
                      <Text style={ideation.active ? styles.booleanYes : styles.booleanNo}>{ideation.active ? 'Yes' : 'No'}</Text>
                    </View>
                  )}
                  {hasValue(ideation.frequency) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Frequency:</Text>
                      <Text style={styles.fieldValue}>{safeString(ideation.frequency)}</Text>
                    </View>
                  )}
                  {hasValue(ideation.duration) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Duration:</Text>
                      <Text style={styles.fieldValue}>{safeString(ideation.duration)}</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Plan */}
            {hasValue(record.plan) && typeof record.plan === 'object' && (() => {
              const plan = record.plan;
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Suicide Plan</Text>
                  {plan.hasPlan !== undefined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Has Plan:</Text>
                      <Text style={plan.hasPlan ? styles.booleanYes : styles.booleanNo}>{plan.hasPlan ? 'Yes' : 'No'}</Text>
                    </View>
                  )}
                  {hasValue(plan.method) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Method:</Text>
                      <Text style={styles.fieldValue}>{safeString(plan.method)}</Text>
                    </View>
                  )}
                  {hasValue(plan.means) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Means:</Text>
                      <Text style={styles.fieldValue}>{safeString(plan.means)}</Text>
                    </View>
                  )}
                  {hasValue(plan.timeline) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Timeline:</Text>
                      <Text style={styles.fieldValue}>{safeString(plan.timeline)}</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Intent */}
            {hasValue(record.intent) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Intent</Text>
                <Text style={styles.fieldValue}>{safeString(record.intent)}</Text>
              </View>
            )}

            {/* History */}
            {(record.previousAttempts !== undefined || hasValue(record.psychiatricHospitalizations)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>History</Text>
                {record.previousAttempts !== undefined && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Previous Attempts:</Text>
                    <Text style={record.previousAttempts ? styles.booleanYes : styles.booleanNo}>{record.previousAttempts ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                {hasValue(record.psychiatricHospitalizations) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Psychiatric Hospitalizations:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.psychiatricHospitalizations)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Risk Factors */}
            {hasValue(record.riskFactors) && (() => {
              const items = record.riskFactors;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Risk Factors ({items.length})</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {restItems.map((factor, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>{i + 2}. {safeString(factor)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Protective Factors */}
            {hasValue(record.protectiveFactors) && (() => {
              const items = record.protectiveFactors;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Protective Factors ({items.length})</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {restItems.map((factor, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>{i + 2}. {safeString(factor)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Interventions */}
            {hasValue(record.interventions) && (() => {
              const items = record.interventions;
              const firstItem = items[0];
              const restItems = items.slice(1);
              return (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Interventions</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {restItems.map((item, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>{i + 2}. {safeString(item)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Columbia Scale */}
            {hasValue(record.columbiaScale) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Columbia Scale (C-SSRS)</Text>
                <Text style={styles.fieldValue}>{safeString(record.columbiaScale)}</Text>
              </View>
            )}

            {/* Findings */}
            {hasValue(record.findings) && (() => {
              const sentences = splitBySentence(record.findings);
              if (sentences.length === 0) return null;
              const firstItem = sentences[0];
              const restItems = sentences.slice(1);
              return (
                <View style={styles.section} wrap={sentences.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  {restItems.map((s, i) => (
                    <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Assessment */}
            {hasValue(record.assessment) && (() => {
              const sentences = splitBySentence(record.assessment);
              if (sentences.length === 0) return null;
              const firstItem = sentences[0];
              const restItems = sentences.slice(1);
              return (
                <View style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>Assessment</Text>
                    <Text style={styles.listItem}>1. {safeString(firstItem)}</Text>
                  </View>
                  {restItems.map((s, i) => (
                    <Text key={i + 1} style={styles.listItem} wrap={false}>{i + 2}. {safeString(s)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Recommendations — array of {recommendation, date}, date-grouped */}
            {hasValue(record.recommendations) && Array.isArray(record.recommendations) && (() => {
              const recs = record.recommendations.filter(r => hasValue(r?.recommendation) || hasValue(r?.date));
              if (recs.length === 0) return null;
              const groups = [];
              recs.forEach(rec => {
                const d = safeString(rec?.date || '').trim();
                const last = groups[groups.length - 1];
                if (last && last.date === d) last.items.push(rec);
                else groups.push({ date: d, items: [rec] });
              });
              let n = 0;
              return (
                <View style={styles.section} wrap={recs.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations ({recs.length})</Text>
                  {groups.map((group, gi) => (
                    <View key={gi}>
                      {group.date ? <Text style={styles.objBranchLabel}>{safeString(group.date)}</Text> : null}
                      {group.items.map((rec, ri) => {
                        n += 1;
                        return <Text key={ri} style={styles.listItem}>{n}. {safeString(rec?.recommendation || '')}</Text>;
                      })}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Results — recursive object */}
            {hasValue(record.results) && typeof record.results === 'object' && !Array.isArray(record.results) && (() => {
              const rows = flattenObject(record.results, 0, []);
              if (rows.length === 0) return null;
              return (
                <View style={styles.section} wrap={rows.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {rows.map((row, i) => (
                    row.leaf ? (
                      <View key={i} style={[styles.fieldBlock, { marginLeft: 12 + row.depth * 12 }]}>
                        <Text style={styles.objLeafLabel}>{safeString(row.label)}:</Text>
                        <Text style={styles.objLeafValue}>{safeString(row.value)}</Text>
                      </View>
                    ) : (
                      <Text key={i} style={[styles.objBranchLabel, { marginLeft: 12 + row.depth * 12 }]}>{safeString(row.label)}:</Text>
                    )
                  ))}
                </View>
              );
            })()}

            {/* Notes */}
            {hasValue(record.notes) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.fieldValue}>{safeString(record.notes)}</Text>
              </View>
            )}

            {/* Status */}
            {hasValue(record.status) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Status</Text>
                <Text style={styles.fieldValue}>{safeString(record.status)}</Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SuicideRiskAssessmentDocumentPDFTemplate;
