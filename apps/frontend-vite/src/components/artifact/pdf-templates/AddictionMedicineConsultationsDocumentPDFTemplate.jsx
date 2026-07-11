/**
 * AddictionMedicineConsultationsDocumentPDFTemplate.jsx
 * December 2025 PDF Template - Black & White, Helvetica, 14pt minimum
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Sanitize Unicode characters for Helvetica
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μ/g, 'u');
  str = str.replace(/µ/g, 'u');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/–/g, '-');
  str = str.replace(/—/g, '-');
  str = str.replace(/'/g, "'");
  str = str.replace(/'/g, "'");
  str = str.replace(/"/g, '"');
  str = str.replace(/"/g, '"');
  return str;
};

// Split a compound value into individual facts on top-level ';' and ',' (parenthesis-aware).
const splitSemiComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') { depth++; cur += ch; }
    else if (ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); cur += ch; }
    else if ((ch === ';' || ch === ',') && depth === 0) { const t = cur.trim(); if (t) result.push(t); cur = ''; }
    else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length ? result : (text.trim() ? [text.trim()] : []);
};

// Split on top-level commas only (parenthesis-aware) — for comma-separated value lists (symptoms).
const splitByCommaParen = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') { depth++; cur += ch; }
    else if (ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) { const t = cur.trim(); if (t) result.push(t); cur = ''; }
    else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length ? result : (text.trim() ? [text.trim()] : []);
};

// Split on top-level semicolons only (parenthesis-aware) — matches the JSX MAT splitter.
const splitBySemi = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') { depth++; cur += ch; }
    else if (ch === ')' || ch === ']') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ';' && depth === 0) { const t = cur.trim(); if (t) result.push(t); cur = ''; }
    else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length ? result : (text.trim() ? [text.trim()] : []);
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
  },
  recordContainer: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '1px solid #000000',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#000000',
  },
  recordMeta: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid #000000',
    color: '#000000',
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 6,
    color: '#000000',
  },
  fieldBlock: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#000000',
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 12,
    lineHeight: 1.4,
  },
  symptomRow: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 2,
    paddingLeft: 16,
  },
  // Bar Chart Styles
  chartContainer: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #cccccc',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    marginRight: 4,
  },
  legendText: {
    fontSize: 9,
    color: '#666666',
  },
  mainScoreBar: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid #dddddd',
  },
  mainScoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mainScoreLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  mainScoreValue: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  mainInterpretation: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    color: '#000000',
  },
  symptomBarsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    color: '#000000',
  },
  symptomBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  symptomLabel: {
    fontSize: 10,
    width: 100,
    color: '#000000',
  },
  symptomBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  symptomBarBackground: {
    flex: 1,
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  symptomBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  symptomScore: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    width: 30,
    textAlign: 'right',
    marginLeft: 6,
    color: '#000000',
  },
});

// COWS Score color (grayscale for PDF) - higher = worse
const getCOWSGrayscale = (score, max = 48) => {
  const percentage = (score / max) * 100;
  if (percentage <= 10) return '#cccccc';  // Light gray - Mild
  if (percentage <= 25) return '#999999';  // Medium gray - Moderate
  if (percentage <= 50) return '#666666';  // Dark gray - Moderately Severe
  return '#333333';                         // Very dark - Severe
};

// COWS interpretation
const getCOWSInterpretation = (score) => {
  if (score <= 4) return 'Mild';
  if (score <= 12) return 'Moderate';
  if (score <= 24) return 'Moderately Severe';
  return 'Severe';
};

// Symptom score grayscale (0-4)
const getSymptomGrayscale = (score, max = 4) => {
  const percentage = (score / max) * 100;
  if (percentage <= 25) return '#cccccc';
  if (percentage <= 50) return '#999999';
  if (percentage <= 75) return '#666666';
  return '#333333';
};

const AddictionMedicineConsultationsDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;
  const consultations = Array.isArray(templateData) ? templateData : [templateData];

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return String(date);
    }
  };

  const formatFieldLabel = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Render a whole section. The section title goes on the FIRST present block's View (Rule #74:
  // title-inside-first-field, never a standalone sibling that would orphan). Each block is its own
  // View with a page-fitting conditional wrap. A block is { label, value?, items?, splitter? }:
  //  - items  → numbered list (subsection label)
  //  - value  → "Label: value", or numbered parts when a splitter yields >1 part.
  const renderSection = (sectionTitle, blocks) => {
    const present = blocks.filter(b => b.items
      ? (Array.isArray(b.items) && b.items.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0)
      : (b.value !== null && b.value !== undefined && String(b.value).trim() !== ''));
    if (present.length === 0) return null;
    return (
      <View style={styles.section}>
        {present.map((b, bi) => {
          const titleEl = bi === 0 ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;
          if (b.items) {
            const arr = b.items.filter(x => x !== null && x !== undefined && String(x).trim() !== '');
            return (
              <View key={bi} style={styles.fieldBlock} wrap={arr.length > 8 ? undefined : false}>
                {titleEl}
                <Text style={styles.subsectionTitle}>{safeString(b.label)}:</Text>
                {arr.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>)}
              </View>
            );
          }
          const parts = b.splitter ? b.splitter(String(b.value)) : [String(b.value)];
          return (
            <View key={bi} style={styles.fieldBlock} wrap={parts.length > 8 ? undefined : false}>
              {titleEl}
              <Text style={styles.fieldLabel}>{safeString(b.label)}:</Text>
              {parts.length > 1
                ? parts.map((p, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(p)}</Text>)
                : <Text style={styles.fieldValue}>{safeString(parts[0])}</Text>}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Addiction Medicine Consultations</Text>

        {consultations.filter(c => c && typeof c === 'object').map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View wrap={false}>
              <Text style={styles.recordTitle}>
                {safeString(`Addiction Medicine Consultation ${idx + 1}`)}
              </Text>
              <Text style={styles.recordMeta}>
                Date: {safeString(formatDate(record.date))}
              </Text>
            </View>

            {/* 1. Consulting Provider */}
            {record.consultingProvider && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Consulting Provider</Text>
                <Text style={styles.fieldValue}>{safeString(record.consultingProvider)}</Text>
              </View>
            )}

            {/* 2. Substance Use History */}
            {record.substanceUseHistory?.length > 0 && (
              <View style={styles.section}>
                {record.substanceUseHistory.map((item, i) => {
                  const ci = String(item).indexOf(':');
                  const label = ci > -1 ? String(item).substring(0, ci).trim() : `Substance ${i + 1}`;
                  const valuePart = ci > -1 ? String(item).substring(ci + 1).trim() : String(item);
                  const facts = splitSemiComma(valuePart);
                  return (
                    <View key={i} style={styles.fieldBlock} wrap={facts.length > 8 ? undefined : false}>
                      {i === 0 && <Text style={styles.sectionTitle}>Substance Use History</Text>}
                      <Text style={styles.subsectionTitle}>{safeString(label)}</Text>
                      {facts.map((f, fi) => (
                        <Text key={fi} style={styles.listItem}>{fi + 1}. {safeString(f)}</Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}

            {/* 3. Withdrawal Assessment - With Bar Chart Visualization */}
            {record.withdrawalAssessment && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Withdrawal Assessment</Text>
                  {record.withdrawalAssessment.scale && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Scale:</Text>
                      <Text style={styles.fieldValue}>{safeString(record.withdrawalAssessment.scale)}</Text>
                    </View>
                  )}
                </View>

                {/* Bar Chart Visualization - wrap={false} keeps entire chart on same page */}
                {(record.withdrawalAssessment.score !== undefined ||
                  (record.withdrawalAssessment.symptoms && Object.keys(record.withdrawalAssessment.symptoms).length > 0)) && (
                  <View style={styles.chartContainer} wrap={false}>
                    {/* Legend */}
                    <View style={styles.chartLegend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#cccccc' }]} />
                        <Text style={styles.legendText}>Mild</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#999999' }]} />
                        <Text style={styles.legendText}>Moderate</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#666666' }]} />
                        <Text style={styles.legendText}>Mod-Severe</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#333333' }]} />
                        <Text style={styles.legendText}>Severe</Text>
                      </View>
                    </View>

                    {/* Main COWS Score Bar */}
                    {record.withdrawalAssessment.score !== undefined && record.withdrawalAssessment.score > 0 && (
                      <View style={styles.mainScoreBar}>
                        <View style={styles.mainScoreHeader}>
                          <Text style={styles.mainScoreLabel}>COWS Score</Text>
                          <Text style={styles.mainScoreValue}>{record.withdrawalAssessment.score}/48</Text>
                        </View>
                        <View style={styles.barContainer}>
                          <View style={styles.barBackground}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  width: `${Math.min(100, (record.withdrawalAssessment.score / 48) * 100)}%`,
                                  backgroundColor: getCOWSGrayscale(record.withdrawalAssessment.score),
                                },
                              ]}
                            />
                          </View>
                        </View>
                        <Text style={styles.mainInterpretation}>
                          {getCOWSInterpretation(record.withdrawalAssessment.score)}
                        </Text>
                      </View>
                    )}

                    {/* Symptom Bars */}
                    {record.withdrawalAssessment.symptoms && Object.keys(record.withdrawalAssessment.symptoms).length > 0 && (
                      <View>
                        <Text style={styles.symptomBarsTitle}>Individual Symptoms (0-4 Scale)</Text>
                        {Object.entries(record.withdrawalAssessment.symptoms).map(([symptom, score], sIdx) => {
                          const numScore = typeof score === 'number' ? score : parseFloat(score) || 0;
                          return (
                            <View key={sIdx} style={styles.symptomBarRow}>
                              <Text style={styles.symptomLabel}>{safeString(formatFieldLabel(symptom))}</Text>
                              <View style={styles.symptomBarContainer}>
                                <View style={styles.symptomBarBackground}>
                                  <View
                                    style={[
                                      styles.symptomBarFill,
                                      {
                                        width: `${(numScore / 4) * 100}%`,
                                        backgroundColor: getSymptomGrayscale(numScore),
                                      },
                                    ]}
                                  />
                                </View>
                                <Text style={styles.symptomScore}>{numScore}/4</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* Nested per-substance withdrawal (alcohol, opioid, benzodiazepine) */}
                {record.withdrawalAssessment.alcohol && (() => {
                  const sub = record.withdrawalAssessment.alcohol;
                  const syms = sub.symptoms ? splitByCommaParen(sub.symptoms) : [];
                  return (
                    <View style={styles.fieldBlock} wrap={syms.length > 8 ? undefined : false}>
                      <Text style={styles.subsectionTitle}>Alcohol ({safeString(sub.scale || 'N/A')})</Text>
                      {(sub.score !== undefined || sub.severity) && (
                        <Text style={styles.fieldValue}>Score: {safeString(sub.score)} — {safeString(sub.severity)}</Text>
                      )}
                      {syms.map((s, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                      ))}
                    </View>
                  );
                })()}
                {record.withdrawalAssessment.opioid && (() => {
                  const sub = record.withdrawalAssessment.opioid;
                  const syms = sub.symptoms ? splitByCommaParen(sub.symptoms) : [];
                  return (
                    <View style={styles.fieldBlock} wrap={syms.length > 8 ? undefined : false}>
                      <Text style={styles.subsectionTitle}>Opioid ({safeString(sub.scale || 'N/A')})</Text>
                      {(sub.score !== undefined || sub.severity) && (
                        <Text style={styles.fieldValue}>Score: {safeString(sub.score)} — {safeString(sub.severity)}</Text>
                      )}
                      {syms.map((s, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                      ))}
                    </View>
                  );
                })()}
                {record.withdrawalAssessment.benzodiazepine && (() => {
                  const benzo = record.withdrawalAssessment.benzodiazepine;
                  const pairs = (benzo && typeof benzo === 'object')
                    ? Object.entries(benzo).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '').map(([k, v]) => [formatFieldLabel(k), String(v)])
                    : [['', String(benzo)]];
                  if (pairs.length === 0) return null;
                  return (
                    <View style={styles.fieldBlock} wrap={false}>
                      <Text style={styles.subsectionTitle}>Benzodiazepine</Text>
                      {pairs.map(([lbl, val], i) => (
                        <View key={i} style={{ marginBottom: 4 }}>
                          {lbl ? <Text style={styles.fieldLabel}>{safeString(lbl)}:</Text> : null}
                          <Text style={styles.fieldValue}>{safeString(val)}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            )}

            {/* 4. Medication-Assisted Treatment */}
            {record.medicationAssistedTreatment && renderSection('Medication-Assisted Treatment', [
              { label: 'Medication', value: record.medicationAssistedTreatment.medication },
              { label: 'Induction Dose', value: record.medicationAssistedTreatment.inductionDose },
              { label: 'Induction Date', value: record.medicationAssistedTreatment.inductionDate },
              { label: 'Induction Protocol', value: record.medicationAssistedTreatment.inductionProtocol, splitter: splitBySemi },
              { label: 'Target Maintenance Dose', value: record.medicationAssistedTreatment.targetMaintenanceDose },
              { label: 'Target Dose', value: record.medicationAssistedTreatment.targetDose },
              { label: 'Titration Plan', value: record.medicationAssistedTreatment.titrationPlan, splitter: splitBySemi },
              { label: 'Maintenance Duration', value: record.medicationAssistedTreatment.maintenanceDuration, splitter: splitBySemi },
              { label: 'Prior MAT', value: record.medicationAssistedTreatment.priorMAT },
              { label: 'Adjunct Medications', items: record.medicationAssistedTreatment.adjunctMedications },
            ])}

            {/* 5. Urine Drug Screening */}
            {record.urineDrugScreening?.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Urine Drug Screening</Text>
                  <Text style={styles.listItem}>
                    1. {safeString(record.urineDrugScreening[0])}
                  </Text>
                </View>
                {record.urineDrugScreening.slice(1).map((item, i) => (
                  <Text key={i} style={styles.listItem}>
                    {i + 2}. {safeString(item)}
                  </Text>
                ))}
              </View>
            )}

            {/* 6. Relapse Prevention */}
            {record.relapsePrevention && renderSection('Relapse Prevention', [
              { label: 'High-Risk Situations', items: record.relapsePrevention.highRiskSituations },
              { label: 'Triggers', items: record.relapsePrevention.triggers },
              { label: 'Coping Strategies', items: record.relapsePrevention.copingStrategies },
              { label: 'Coping Skills', items: record.relapsePrevention.copingSkills },
              { label: 'Emergency Plan', items: record.relapsePrevention.emergencyPlan },
              { label: 'Support Network', items: record.relapsePrevention.supportNetwork },
              { label: 'Environmental Modifications', items: record.relapsePrevention.environmentalModifications },
            ])}

            {/* 7. Recovery Programs */}
            {record.recoveryPrograms?.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Recovery Programs</Text>
                  <Text style={styles.listItem}>
                    1. {safeString(record.recoveryPrograms[0])}
                  </Text>
                </View>
                {record.recoveryPrograms.slice(1).map((item, i) => (
                  <Text key={i} style={styles.listItem}>
                    {i + 2}. {safeString(item)}
                  </Text>
                ))}
              </View>
            )}

            {/* 8. Harm Reduction Counseling */}
            {record.harmReductionCounseling && renderSection('Harm Reduction Counseling', [
              { label: 'Naloxone Provided', value: record.harmReductionCounseling.naloxoneProvided !== undefined ? (record.harmReductionCounseling.naloxoneProvided ? 'Yes' : 'No') : undefined },
              { label: 'Naloxone Kits', value: record.harmReductionCounseling.naloxoneKits },
              { label: 'Syringe Services Referral', value: record.harmReductionCounseling.syringeServicesReferral !== undefined ? (record.harmReductionCounseling.syringeServicesReferral ? 'Yes' : 'No') : undefined },
              { label: 'Naloxone Training', value: record.harmReductionCounseling.naloxoneTraining, splitter: splitSemiComma },
              { label: 'Fentanyl Education', value: record.harmReductionCounseling.fentanylEducation, splitter: splitSemiComma },
              { label: 'Safer Use Education', value: record.harmReductionCounseling.saferUseEducation, splitter: splitSemiComma },
              { label: 'Needle Exchange', value: record.harmReductionCounseling.needleExchange, splitter: splitSemiComma },
              { label: 'Safe Use Counseling', items: record.harmReductionCounseling.safeUseCounseling },
            ])}

            {/* 9. Psychiatric Comorbidities */}
            {record.psychiatricComorbidities?.length > 0 && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Psychiatric Comorbidities</Text>
                  <Text style={styles.listItem}>
                    1. {safeString(record.psychiatricComorbidities[0])}
                  </Text>
                </View>
                {record.psychiatricComorbidities.slice(1).map((item, i) => (
                  <Text key={i} style={styles.listItem}>
                    {i + 2}. {safeString(item)}
                  </Text>
                ))}
              </View>
            )}

            {/* 10. Social Determinants */}
            {record.socialDeterminants && renderSection('Social Determinants', [
              { label: 'Housing', value: record.socialDeterminants.housing, splitter: splitSemiComma },
              { label: 'Employment', value: record.socialDeterminants.employment, splitter: splitSemiComma },
              { label: 'Income', value: record.socialDeterminants.income, splitter: splitSemiComma },
              { label: 'Family Support', value: record.socialDeterminants.familySupport, splitter: splitSemiComma },
              { label: 'Legal Issues', value: record.socialDeterminants.legalIssues, splitter: splitSemiComma },
              { label: 'Legal History', value: record.socialDeterminants.legalHistory, splitter: splitSemiComma },
            ])}

            {/* 11. Treatment Plan */}
            {record.treatmentPlan && renderSection('Treatment Plan', [
              { label: 'Level of Care', value: record.treatmentPlan.levelOfCare },
              { label: 'Backup Plan', value: record.treatmentPlan.backupPlan },
              { label: 'Phase 1', value: record.treatmentPlan.phase1 },
              { label: 'Phase 2', value: record.treatmentPlan.phase2 },
              { label: 'Phase 3', value: record.treatmentPlan.phase3 },
              { label: 'Psychiatric Treatment', value: record.treatmentPlan.psychiatricTreatment },
              { label: 'Counseling', value: record.treatmentPlan.counseling },
              { label: 'Components', items: record.treatmentPlan.components },
            ])}

            {/* 12. Prognosis */}
            {record.prognosis && renderSection('Prognosis', [
              { label: 'Overall', value: record.prognosis.overall },
              { label: 'With MAT', value: record.prognosis.withMAT },
              { label: 'Without MAT', value: record.prognosis.withoutMAT },
              { label: 'Favorable Factors', items: record.prognosis.favorableFactors },
              { label: 'Unfavorable Factors', items: record.prognosis.unfavorableFactors },
              { label: 'Critical Inflection Points', items: record.prognosis.criticalInflectionPoints },
            ])}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AddictionMedicineConsultationsDocumentPDFTemplate;
