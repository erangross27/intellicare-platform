/**
 * PatientEducationContextPDFTemplate.jsx
 * March 2026 — Courier — LETTER size — patient education context
 * Collection: patient_education_context
 *
 * Accepts: { document } where document is array of records (pdfData from JSX)
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.4 },
  line: { fontSize: 11, marginBottom: 2, lineHeight: 1.4 },
  emptyLine: { fontSize: 11, marginBottom: 8 },
  section: { marginBottom: 12 },
  title: { fontSize: 16, marginBottom: 8, fontFamily: 'Helvetica-Bold' },
  sectionTitle: { fontSize: 13, marginBottom: 6, marginTop: 12, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 9, color: '#666', textAlign: 'center', borderTopWidth: 1, borderTopColor: '#ddd', borderTopStyle: 'solid', paddingTop: 8 },
  pageNumber: { fontSize: 9, textAlign: 'center', color: '#666' },
});

const safeStr = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return String(v);
};

const PatientEducationContextPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (docProp) {
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.patient_education_context) return Array.isArray(r.patient_education_context) ? r.patient_education_context : [r.patient_education_context];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.patient_education_context) return Array.isArray(dd.patient_education_context) ? dd.patient_education_context : [dd.patient_education_context]; return [dd]; }
      return [r];
    });
    records = arr.filter(r => r && typeof r === 'object');
  }

  if (!records.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.title}>PATIENT EDUCATION CONTEXT</Text>
          <Text style={styles.line}>No patient education records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {records.map((record, recIdx) => {
        const ce = record.conditionExplanation || {};
        const summary = record.simplifiedSummary || ce.simplifiedSummary;
        const keyPoints = record.keyPoints || ce.keyPoints;
        const whatToExpect = record.whatToExpect || ce.whatToExpect;
        const warningSignsToWatch = record.warningSignsToWatch || ce.warningSignsToWatch;
        const meds = Array.isArray(record.medicationInstructions) ? record.medicationInstructions : [];
        const lifestyle = Array.isArray(record.lifestyleGuidance) ? record.lifestyleGuidance : [];
        const resources = Array.isArray(record.resources) ? record.resources : [];

        return (
          <Page key={recIdx} size="LETTER" style={styles.page} wrap>
            {/* Header */}
            <Text style={styles.title}>PATIENT EDUCATION CONTEXT</Text>
            {record.patientName && <Text style={styles.line}>Patient: {safeStr(record.patientName)}</Text>}
            <Text style={styles.emptyLine}> </Text>

            {/* Condition Explanation */}
            {(summary || (Array.isArray(keyPoints) && keyPoints.length > 0) || whatToExpect || (Array.isArray(warningSignsToWatch) && warningSignsToWatch.length > 0)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>CONDITION EXPLANATION</Text>

                {summary && (
                  <View>
                    <Text style={styles.line}>Summary:</Text>
                    <Text style={styles.line}>{safeStr(summary)}</Text>
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                )}

                {Array.isArray(keyPoints) && keyPoints.length > 0 && (
                  <View>
                    <Text style={styles.line}>Key Points:</Text>
                    {keyPoints.map((point, i) => (
                      <Text key={i} style={styles.line}>  {i + 1}. {safeStr(point)}</Text>
                    ))}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                )}

                {whatToExpect && (
                  <View>
                    <Text style={styles.line}>What to Expect:</Text>
                    <Text style={styles.line}>{safeStr(whatToExpect)}</Text>
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                )}

                {Array.isArray(warningSignsToWatch) && warningSignsToWatch.length > 0 && (
                  <View>
                    <Text style={styles.line}>Warning Signs to Watch:</Text>
                    {warningSignsToWatch.map((sign, i) => (
                      <Text key={i} style={styles.line}>  {i + 1}. {safeStr(sign)}</Text>
                    ))}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                )}
              </View>
            )}

            {/* Medication Instructions */}
            {meds.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>MEDICATION INSTRUCTIONS</Text>
                {meds.map((med, i) => (
                  <View key={i} style={{ marginBottom: 8 }}>
                    <Text style={styles.line}>{i + 1}. {safeStr(med.medication || `Medication ${i + 1}`)}</Text>
                    {med.purpose && <Text style={styles.line}>   Purpose: {safeStr(med.purpose)}</Text>}
                    {med.howToTake && <Text style={styles.line}>   How to Take: {safeStr(med.howToTake)}</Text>}
                    {Array.isArray(med.commonSideEffects) && med.commonSideEffects.length > 0 && (
                      <Text style={styles.line}>   Common Side Effects: {med.commonSideEffects.map(safeStr).join(', ')}</Text>
                    )}
                    {Array.isArray(med.whenToCallDoctor) && med.whenToCallDoctor.length > 0 && (
                      <Text style={styles.line}>   When to Call Doctor: {med.whenToCallDoctor.map(safeStr).join('; ')}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Lifestyle Guidance */}
            {lifestyle.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>LIFESTYLE GUIDANCE</Text>
                {lifestyle.map((item, i) => (
                  <View key={i} style={{ marginBottom: 8 }}>
                    <Text style={styles.line}>{i + 1}. {safeStr(item.topic || `Lifestyle ${i + 1}`)}</Text>
                    {item.recommendation && <Text style={styles.line}>   Recommendation: {safeStr(item.recommendation)}</Text>}
                    {item.reasoning && <Text style={styles.line}>   Reasoning: {safeStr(item.reasoning)}</Text>}
                    {Array.isArray(item.practicalTips) && item.practicalTips.length > 0 && (
                      <View>
                        <Text style={styles.line}>   Practical Tips:</Text>
                        {item.practicalTips.map((tip, ti) => (
                          <Text key={ti} style={styles.line}>     - {safeStr(tip)}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Resources */}
            {resources.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>RESOURCES</Text>
                {resources.map((item, i) => (
                  <View key={i} style={{ marginBottom: 8 }}>
                    <Text style={styles.line}>{i + 1}. {safeStr(item.name || `Resource ${i + 1}`)}{item.type ? ` (${safeStr(item.type)})` : ''}</Text>
                    {item.purpose && <Text style={styles.line}>   Purpose: {safeStr(item.purpose)}</Text>}
                    {item.relevance && <Text style={styles.line}>   Relevance: {safeStr(item.relevance)}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text>CONFIDENTIAL - Protected Health Information (PHI)</Text>
              <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

export default PatientEducationContextPDFTemplate;
