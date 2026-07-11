import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Blood Smears Document PDF Template - December 2025
 * Black & White only for professional medical printing
 * Simple layout - text flows naturally to next page
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 14,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
    color: '#000000',
  },
  recordSection: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  recordTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  recordMeta: {
    fontSize: 13,
    marginBottom: 12,
    color: '#000000',
  },
  fieldContainer: {
    marginBottom: 10,
  },
  fieldTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
    color: '#000000',
  },
  fieldContent: {
    fontSize: 14,
    lineHeight: 1.5,
    paddingLeft: 8,
    color: '#000000',
  },
  listItem: {
    fontSize: 14,
    lineHeight: 1.5,
    paddingLeft: 8,
    marginBottom: 2,
    color: '#000000',
  },
  emptyState: {
    fontSize: 14,
    textAlign: 'center',
    padding: 40,
    color: '#000000',
  },
});

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

const BloodSmearsDocumentPDFTemplate = ({ document: templateData }) => {
  // Data unwrapping
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.blood_smears) return Array.isArray(templateData.blood_smears) ? templateData.blood_smears : [templateData.blood_smears];
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.blood_smears) return Array.isArray(docData.blood_smears) ? docData.blood_smears : [docData.blood_smears];
      return [docData];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Blood Smear Analysis Report</Text>
          <Text style={styles.emptyState}>No blood smear records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Blood Smear Analysis Report</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            {/* Record Header */}
            <View wrap={false}>
              <Text style={styles.recordTitle}>
                {String(record._documentTitle || `Blood Smear ${idx + 1}`)}
              </Text>
              {record.date && (
                <Text style={styles.recordMeta}>
                  Date: {formatDate(record.date)}
                </Text>
              )}
            </View>

            {/* Test Information */}
            {(record.provider || record.facility || record.specimenType || record.collectionSite || record.stainingMethod || record.smearQuality || record.clinicalIndication) && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.fieldTitle}>Test Information</Text>
                {record.provider && (
                  <Text style={styles.fieldContent}>Provider: {String(record.provider || '')}</Text>
                )}
                {record.facility && (
                  <Text style={styles.fieldContent}>Facility: {String(record.facility || '')}</Text>
                )}
                {record.specimenType && (
                  <Text style={styles.fieldContent}>Specimen Type: {String(record.specimenType || '')}</Text>
                )}
                {record.collectionSite && (
                  <Text style={styles.fieldContent}>Collection Site: {String(record.collectionSite || '')}</Text>
                )}
                {record.stainingMethod && (
                  <Text style={styles.fieldContent}>Staining Method: {String(record.stainingMethod || '')}</Text>
                )}
                {record.smearQuality && (
                  <Text style={styles.fieldContent}>Smear Quality: {String(record.smearQuality || '')}</Text>
                )}
                {record.clinicalIndication && (
                  <Text style={styles.fieldContent}>Clinical Indication: {String(record.clinicalIndication || '')}</Text>
                )}
              </View>
            )}

            {/* RBC Morphology */}
            {record.redBloodCellMorphology && record.redBloodCellMorphology.length > 0 && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.fieldTitle}>RBC Morphology</Text>
                {record.redBloodCellMorphology.map((item, iIdx) => (
                  <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {String(item || '')}</Text>
                ))}
              </View>
            )}

            {/* Erythrocyte Inclusions */}
            {record.erythrocyteInclusions && record.erythrocyteInclusions.length > 0 && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.fieldTitle}>Erythrocyte Inclusions</Text>
                {record.erythrocyteInclusions.map((item, iIdx) => (
                  <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {String(item || '')}</Text>
                ))}
              </View>
            )}

            {/* Platelet Findings */}
            {(record.plateletEstimate || (record.plateletMorphology && record.plateletMorphology.length > 0) || record.rouleauxFormation) && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.fieldTitle}>Platelet Findings</Text>
                {record.plateletEstimate && (
                  <Text style={styles.fieldContent}>Platelet Estimate: {String(record.plateletEstimate || '')}</Text>
                )}
                {record.plateletMorphology && record.plateletMorphology.length > 0 && (
                  <Text style={styles.fieldContent}>Platelet Morphology: {String(Array.isArray(record.plateletMorphology) ? record.plateletMorphology.join(', ') : record.plateletMorphology || '')}</Text>
                )}
                {record.rouleauxFormation && (
                  <Text style={styles.fieldContent}>Rouleaux Formation: {String(record.rouleauxFormation || '')}</Text>
                )}
              </View>
            )}

            {/* WBC Findings */}
            {(record.whiteBloodCellCount || record.blastPercentage !== undefined && record.blastPercentage !== null && record.blastPercentage !== '' || record.whiteBloodCellDifferential) && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.fieldTitle}>WBC Findings</Text>
                {record.whiteBloodCellCount && (
                  <Text style={styles.fieldContent}>WBC Count: {String(record.whiteBloodCellCount || '')}</Text>
                )}
                {record.whiteBloodCellDifferential && (
                  <Text style={styles.fieldContent}>WBC Differential: {String(record.whiteBloodCellDifferential || '')}</Text>
                )}
                {record.blastPercentage !== undefined && record.blastPercentage !== null && record.blastPercentage !== '' && (
                  <Text style={styles.fieldContent}>Blast Percentage: {String(record.blastPercentage)}%</Text>
                )}
              </View>
            )}

            {/* Leukocyte Abnormalities */}
            {record.leukocyteAbnormalities && record.leukocyteAbnormalities.length > 0 && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.fieldTitle}>Leukocyte Abnormalities</Text>
                {record.leukocyteAbnormalities.map((item, iIdx) => (
                  <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {String(item || '')}</Text>
                ))}
              </View>
            )}

            {/* Abnormal Cells */}
            {record.abnormalCells && record.abnormalCells.length > 0 && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.fieldTitle}>Abnormal Cells</Text>
                {record.abnormalCells.map((item, iIdx) => (
                  <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {String(item || '')}</Text>
                ))}
              </View>
            )}

            {/* Parasite Identification */}
            {record.parasiteIdentification && record.parasiteIdentification.length > 0 && (
              <View style={styles.fieldContainer} wrap={record.parasiteIdentification.length > 8 ? undefined : false}>
                <Text style={styles.fieldTitle}>Parasite Identification</Text>
                {record.parasiteIdentification.map((item, iIdx) => (
                  <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {String(item || '')}</Text>
                ))}
              </View>
            )}

            {/* Microorganisms */}
            {record.microorganisms && record.microorganisms.length > 0 && (
              <View style={styles.fieldContainer} wrap={record.microorganisms.length > 8 ? undefined : false}>
                <Text style={styles.fieldTitle}>Microorganisms</Text>
                {record.microorganisms.map((item, iIdx) => (
                  <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {String(item || '')}</Text>
                ))}
              </View>
            )}

            {/* Microscopic Findings */}
            {record.microscopicFindings && (() => { const items = String(record.microscopicFindings).split(/,\s*/).filter(s => s.trim()); return (<View style={styles.fieldContainer} wrap={false}><Text style={styles.fieldTitle}>Microscopic Findings</Text>{items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item.trim()}</Text>)}</View>); })()}

            {/* Interpretation */}
            {record.interpretation && (() => { const sentences = String(record.interpretation).split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); return (<View style={styles.fieldContainer}><Text style={styles.fieldTitle}>Interpretation</Text>{sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/\.$/, '')}</Text>)}</View>); })()}

            {/* Recommended Follow-Up - handle empty arrays */}
            {record.recommendedFollowUp && (Array.isArray(record.recommendedFollowUp) ? record.recommendedFollowUp.length > 0 : true) && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.fieldTitle}>Recommended Follow-Up</Text>
                <Text style={styles.fieldContent}>
                  {String(Array.isArray(record.recommendedFollowUp) ? record.recommendedFollowUp.join(', ') : record.recommendedFollowUp || '')}
                </Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BloodSmearsDocumentPDFTemplate;
