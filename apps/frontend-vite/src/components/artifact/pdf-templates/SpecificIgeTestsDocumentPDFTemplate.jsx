import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* PDF Styles — March 2026 Standards (Helvetica, LETTER, 20pt title / 12pt body) */
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#606060',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#363636',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#666666',
  },
  recordContainer: {
    marginBottom: 16,
  },
  recordHeader: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#606060',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#363636',
  },
  recordDate: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#606060',
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  fieldLabel: {
    width: 140,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    fontSize: 12,
  },
  fieldValue: {
    flex: 1,
    color: '#1f2937',
    fontSize: 12,
    lineHeight: 1.4,
  },
  listItem: {
    marginBottom: 3,
    paddingLeft: 16,
    fontSize: 12,
    color: '#404040',
    lineHeight: 1.4,
  },
  contentText: {
    fontSize: 12,
    color: '#404040',
    paddingLeft: 8,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  },
});

/* Helper function to format date */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/* Safely format values */
const fmtVal = (v) => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v);
};

/* Render field row component */
const RenderFieldRow = ({ label, value }) => {
  if (!value && value !== 0 && value !== false) return null;
  const displayVal = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{String(label)}:</Text>
      <Text style={styles.fieldValue}>{displayVal}</Text>
    </View>
  );
};

const SpecificIgeTestsDocumentPDFTemplate = ({ document: data }) => {
  /* Handle wrapped collection format */
  let recordsArray;
  if (Array.isArray(data)) {
    recordsArray = data[0]?.specific_ige_tests || data;
  } else {
    recordsArray = data?.specific_ige_tests || (data?.documentData || data?.data || [data]);
  }

  if (!Array.isArray(recordsArray)) {
    recordsArray = [recordsArray];
  }

  recordsArray = recordsArray.filter(Boolean);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Specific IgE Tests</Text>
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            {' | '}{recordsArray.length} record{recordsArray.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Records */}
        {recordsArray.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {String(record.allergenTested || `Specific IgE Test ${idx + 1}`)}
              </Text>
              {record.createdAt && (
                <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
              )}
            </View>

            {/* Test Information */}
            {(record.allergenTested || record.allergenCategory || record.allergenSource || record.allergenCode || record.testMethodology) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Test Information</Text>
                <RenderFieldRow label="ALLERGEN TESTED" value={record.allergenTested} />
                <RenderFieldRow label="ALLERGEN CATEGORY" value={record.allergenCategory} />
                <RenderFieldRow label="ALLERGEN SOURCE" value={record.allergenSource} />
                <RenderFieldRow label="ALLERGEN CODE" value={record.allergenCode} />
                <RenderFieldRow label="TEST METHODOLOGY" value={record.testMethodology} />
              </View>
            )}

            {/* Results — numerics use != null so meaningful zero (IgE 0 / class 0 = negative) renders */}
            {(record.igeLevel != null || record.allergenClass != null || record.totalIgeLevel != null || record.referenceRange || (record.componentTesting && record.componentTesting.length > 0)) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Results</Text>
                <RenderFieldRow label="IGE LEVEL" value={record.igeLevel} />
                <RenderFieldRow label="ALLERGEN CLASS" value={record.allergenClass} />
                <RenderFieldRow label="TOTAL IGE LEVEL" value={record.totalIgeLevel} />
                <RenderFieldRow label="REFERENCE RANGE" value={record.referenceRange} />
                {record.componentTesting && record.componentTesting.length > 0 && (
                  <View>
                    <Text style={[styles.fieldLabel, { paddingLeft: 8, marginBottom: 2 }]}>COMPONENT TESTING:</Text>
                    {record.componentTesting.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{`${i + 1}. ${String(item)}`}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Clinical Assessment */}
            {(record.clinicalRelevance || record.anaphylaxisRisk || (record.crossReactivity && record.crossReactivity.length > 0)) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Clinical Assessment</Text>
                {record.clinicalRelevance && <Text style={styles.contentText}>{fmtVal(record.clinicalRelevance)}</Text>}
                <RenderFieldRow label="ANAPHYLAXIS RISK" value={record.anaphylaxisRisk} />
                {record.crossReactivity && record.crossReactivity.length > 0 && (
                  <View>
                    <Text style={[styles.fieldLabel, { paddingLeft: 8, marginBottom: 2 }]}>CROSS REACTIVITY:</Text>
                    {record.crossReactivity.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{`${i + 1}. ${String(item)}`}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Treatment Plan */}
            {((record.immunotherapyCandidate !== null && record.immunotherapyCandidate !== undefined) || (record.avoidanceRecommendations && record.avoidanceRecommendations.length > 0) || (record.medicationInteractions && record.medicationInteractions.length > 0)) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Treatment Plan</Text>
                {record.immunotherapyCandidate !== null && record.immunotherapyCandidate !== undefined && (
                  <RenderFieldRow label="IMMUNOTHERAPY CANDIDATE" value={record.immunotherapyCandidate} />
                )}
                {record.avoidanceRecommendations && record.avoidanceRecommendations.length > 0 && (
                  <View>
                    <Text style={[styles.fieldLabel, { paddingLeft: 8, marginBottom: 2 }]}>AVOIDANCE RECOMMENDATIONS:</Text>
                    {record.avoidanceRecommendations.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{`${i + 1}. ${String(item)}`}</Text>
                    ))}
                  </View>
                )}
                {record.medicationInteractions && record.medicationInteractions.length > 0 && (
                  <View>
                    <Text style={[styles.fieldLabel, { paddingLeft: 8, marginBottom: 2 }]}>MEDICATION INTERACTIONS:</Text>
                    {record.medicationInteractions.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{`${i + 1}. ${String(item)}`}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Patient History — age uses != null (consistent with on-screen render), explicit parens */}
            {(record.ageAtFirstExposure != null || (record.seasonalVariation !== null && record.seasonalVariation !== undefined) || record.geographicRelevance) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Patient History</Text>
                <RenderFieldRow label="AGE AT FIRST EXPOSURE" value={record.ageAtFirstExposure} />
                {record.seasonalVariation !== null && record.seasonalVariation !== undefined && (
                  <RenderFieldRow label="SEASONAL VARIATION" value={record.seasonalVariation} />
                )}
                <RenderFieldRow label="GEOGRAPHIC RELEVANCE" value={record.geographicRelevance} />
              </View>
            )}

            {/* Follow-Up */}
            {record.retestRecommendation && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Follow-Up</Text>
                <Text style={styles.contentText}>{fmtVal(record.retestRecommendation)}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          IntelliCare - Specific IgE Tests
        </Text>
      </Page>
    </Document>
  );
};

export default SpecificIgeTestsDocumentPDFTemplate;
