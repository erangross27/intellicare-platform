import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * GIRiskAssessmentPDFTemplate - PDF template for GI Risk Assessment
 *
 * Generates formatted PDF with comprehensive GI risk assessment:
 * - Overall risk and clinical assessment
 * - 7 risk categories: bleeding, aspiration, hepatic, pancreatitis, C.diff, obstruction, malabsorption
 * - Protective factors, comorbidities, recommendations
 */

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#000000'
  },
  header: {
    marginBottom: 20
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#000000'
  },
  subtitle: {
    fontSize: 11,
    color: '#000000',
    marginBottom: 2
  },
  section: {
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    borderBottom: '1px solid #000000',
    paddingBottom: 3
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    marginTop: 10
  },
  line: {
    fontSize: 11,
    color: '#000000',
    marginBottom: 2,
    lineHeight: 1.4
  },
  emptyLine: {
    fontSize: 11,
    marginBottom: 6
  },
  listItem: {
    fontSize: 11,
    color: '#000000',
    marginBottom: 2,
    marginLeft: 10,
    lineHeight: 1.4
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    marginTop: 4,
    marginLeft: 5
  },
  medicationItem: {
    fontSize: 11,
    color: '#000000',
    marginBottom: 2,
    marginLeft: 15,
    lineHeight: 1.4
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#000000',
    textAlign: 'center',
    paddingTop: 10
  },
  footerText: {
    marginBottom: 2
  }
});

const GIRiskAssessmentPDFTemplate = ({ document, data = document, patientName }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const riskCategories = [
    { key: 'bleedingRisk', name: 'GI Bleeding Risk', icon: '🩸' },
    { key: 'aspirationRisk', name: 'Aspiration Risk', icon: '🫁' },
    { key: 'hepaticRisk', name: 'Hepatic Risk', icon: '🫀' },
    { key: 'pancreatitisRisk', name: 'Pancreatitis Risk', icon: '🔬' },
    { key: 'cDiffRisk', name: 'C. diff Risk', icon: '🦠' },
    { key: 'obstructionRisk', name: 'Obstruction Risk', icon: '🚫' },
    { key: 'malabsorptionRisk', name: 'Malabsorption Risk', icon: '⚠️' }
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>COMPREHENSIVE GI RISK ASSESSMENT</Text>
          {patientName && (
            <Text style={styles.subtitle}>Patient: {patientName}</Text>
          )}
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {/* Overall Risk Level */}
        {data.overallRiskLevel && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>OVERALL RISK LEVEL</Text>
            <Text style={styles.line}>{data.overallRiskLevel}</Text>
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* Clinical Assessment */}
        {data.assessment && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>CLINICAL ASSESSMENT</Text>
            <Text style={styles.line}>{data.assessment}</Text>
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* Risk Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RISK CATEGORIES</Text>
          <Text style={styles.emptyLine}> </Text>

          {riskCategories.map((category, idx) => {
            const riskData = data[category.key];
            if (!riskData) return null;

            // Check if category has any content
            const hasRiskFactors = riskData.riskFactors && riskData.riskFactors.length > 0;
            const hasRecommendations = riskData.recommendations && riskData.recommendations.length > 0;
            const hasMedications = category.key === 'bleedingRisk' && riskData.currentMedications && (
              (riskData.currentMedications.anticoagulants && riskData.currentMedications.anticoagulants.length > 0) ||
              (riskData.currentMedications.antiplatelets && riskData.currentMedications.antiplatelets.length > 0) ||
              (riskData.currentMedications.nsaids && riskData.currentMedications.nsaids.length > 0) ||
              (riskData.currentMedications.ppiUse !== undefined)
            );
            const hasHepatotoxic = category.key === 'hepaticRisk' && riskData.hepatotoxicMedications && riskData.hepatotoxicMedications.length > 0;
            const hasAntibiotics = category.key === 'cDiffRisk' && riskData.recentAntibiotics && riskData.recentAntibiotics.length > 0;

            // Only render if has content
            if (!hasRiskFactors && !hasRecommendations && !hasMedications && !hasHepatotoxic && !hasAntibiotics) {
              return null;
            }

            return (
              <View key={idx} style={styles.section} wrap={false}>
                <Text style={styles.categoryTitle}>
                  {category.name}
                </Text>
                {riskData.riskLevel && (
                  <Text style={styles.line}>Risk Level: {riskData.riskLevel}</Text>
                )}
                <Text style={styles.emptyLine}> </Text>

                {/* Risk Factors */}
                {hasRiskFactors && (
                  <View>
                    <Text style={styles.subsectionTitle}>Risk Factors:</Text>
                    {riskData.riskFactors.map((factor, fIdx) => (
                      <Text key={fIdx} style={styles.listItem}>• {factor}</Text>
                    ))}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                )}

                {/* Current Medications (Bleeding Risk) */}
                {category.key === 'bleedingRisk' && hasMedications && (
                  <View>
                    <Text style={styles.subsectionTitle}>Current Medications:</Text>
                    {riskData.currentMedications.anticoagulants && riskData.currentMedications.anticoagulants.length > 0 && (
                      <View>
                        <Text style={styles.line}>  Anticoagulants:</Text>
                        {riskData.currentMedications.anticoagulants.map((med, mIdx) => (
                          <Text key={mIdx} style={styles.medicationItem}>• {med}</Text>
                        ))}
                      </View>
                    )}
                    {riskData.currentMedications.antiplatelets && riskData.currentMedications.antiplatelets.length > 0 && (
                      <View>
                        <Text style={styles.line}>  Antiplatelets:</Text>
                        {riskData.currentMedications.antiplatelets.map((med, mIdx) => (
                          <Text key={mIdx} style={styles.medicationItem}>• {med}</Text>
                        ))}
                      </View>
                    )}
                    {riskData.currentMedications.nsaids && riskData.currentMedications.nsaids.length > 0 && (
                      <View>
                        <Text style={styles.line}>  NSAIDs:</Text>
                        {riskData.currentMedications.nsaids.map((med, mIdx) => (
                          <Text key={mIdx} style={styles.medicationItem}>• {med}</Text>
                        ))}
                      </View>
                    )}
                    {riskData.currentMedications.ppiUse !== undefined && (
                      <Text style={styles.line}>  PPI Use: {riskData.currentMedications.ppiUse ? 'Yes' : 'No'}</Text>
                    )}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                )}

                {/* Hepatotoxic Medications (Hepatic Risk) */}
                {category.key === 'hepaticRisk' && hasHepatotoxic && (
                  <View>
                    <Text style={styles.subsectionTitle}>Hepatotoxic Medications:</Text>
                    {riskData.hepatotoxicMedications.map((med, mIdx) => (
                      <Text key={mIdx} style={styles.listItem}>• {med}</Text>
                    ))}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                )}

                {/* Recent Antibiotics (C.diff Risk) */}
                {category.key === 'cDiffRisk' && hasAntibiotics && (
                  <View>
                    <Text style={styles.subsectionTitle}>Recent Antibiotics:</Text>
                    {riskData.recentAntibiotics.map((med, mIdx) => (
                      <Text key={mIdx} style={styles.listItem}>• {med}</Text>
                    ))}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                )}

                {/* Recommendations */}
                {hasRecommendations && (
                  <View>
                    <Text style={styles.subsectionTitle}>Recommendations:</Text>
                    {riskData.recommendations.map((rec, rIdx) => (
                      <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {rec}</Text>
                    ))}
                    <Text style={styles.emptyLine}> </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Protective Factors */}
        {data.protectiveFactors && data.protectiveFactors.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>PROTECTIVE FACTORS</Text>
            {data.protectiveFactors.map((factor, idx) => (
              <Text key={idx} style={styles.listItem}>• {factor}</Text>
            ))}
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* Comorbidities */}
        {data.comorbidities && data.comorbidities.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>COMORBIDITIES</Text>
            {data.comorbidities.map((condition, idx) => (
              <Text key={idx} style={styles.listItem}>• {condition}</Text>
            ))}
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* Clinical Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>CLINICAL RECOMMENDATIONS</Text>
            {data.recommendations.map((rec, idx) => (
              <Text key={idx} style={styles.listItem}>{idx + 1}. {rec}</Text>
            ))}
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* Provider and Date */}
        <View style={styles.section}>
          {data.provider && <Text style={styles.line}>Provider: {data.provider}</Text>}
          {(data.date || data.documentDate) && (
            <Text style={styles.line}>Date: {formatDate(data.date || data.documentDate)}</Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            This document contains Protected Health Information (PHI) - Handle according to HIPAA guidelines
          </Text>
          <Text style={styles.footerText}>
            IntelliCare Medical Records System
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default GIRiskAssessmentPDFTemplate;
