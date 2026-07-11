import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* PDF Styles - Helvetica LETTER 20pt/12pt */
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
    width: 160,
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
  diagnosisText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#414141',
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

/* Chart styles */
const chartStyles = StyleSheet.create({
  chartSection: {
    marginBottom: 18,
    padding: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#a1a1a1',
  },
  legend: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  legendColor: {
    width: 12,
    height: 12,
    marginRight: 4,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 9,
    color: '#404040',
  },
  barChartRow: {
    marginBottom: 14,
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#1f2937',
  },
  barCategoryValue: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  barBackground: {
    height: 20,
    backgroundColor: '#a1a1a1',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: {
    height: 20,
    borderRadius: 4,
  },
  barScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 6,
  },
  scaleItem: {
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  barInterpretation: {
    fontSize: 10,
    marginTop: 4,
  },
});

/* prettyKey: turn a dynamic object key (camelCase / snake_case) into a Title-Case label */
const prettyKey = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
};

/* flattenMlcValue: readable flatten for a melanocytic subfield value (string / array / nested object) */
const flattenMlcValue = (v) => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(flattenMlcValue).filter(Boolean).join('; ');
  if (typeof v === 'object') return Object.entries(v).map(([k, vv]) => `${prettyKey(k)}: ${flattenMlcValue(vv)}`).join('; ');
  return String(v);
};

/* mlcEntries: present, non-empty entries of the dynamic-key melanocytic object */
const getMlcEntries = (mlc) => {
  if (!mlc || typeof mlc !== 'object' || Array.isArray(mlc)) return [];
  return Object.entries(mlc).filter(([, v]) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  });
};

/* Helper function to format date */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

/* Breslow helpers */
const getBreslowColor = (thickness) => {
  if (thickness === null || thickness === undefined) return '#6b7280';
  if (thickness === 0) return '#898989';
  if (thickness <= 1.0) return '#898989';
  if (thickness <= 2.0) return '#7a7a7a';
  if (thickness <= 4.0) return '#a7a7a7';
  return '#777777';
};

const getBreslowInterpretation = (thickness) => {
  if (thickness === null || thickness === undefined) return 'Unknown';
  if (thickness === 0) return 'Melanoma In Situ (Non-invasive)';
  if (thickness <= 1.0) return 'T1 - Good Prognosis';
  if (thickness <= 2.0) return 'T2 - Intermediate Prognosis';
  if (thickness <= 4.0) return 'T3 - Higher Risk';
  return 'T4 - Poor Prognosis';
};

const getTStage = (thickness) => {
  if (thickness === null || thickness === undefined) return null;
  if (thickness === 0) return 'Tis';
  if (thickness <= 1.0) return 'T1';
  if (thickness <= 2.0) return 'T2';
  if (thickness <= 4.0) return 'T3';
  return 'T4';
};

/* Render field row component */
const RenderFieldRow = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{String(label)}:</Text>
      <Text style={styles.fieldValue}>{String(value)}</Text>
    </View>
  );
};

/* Legend component for PDF */
const PDFLegend = () => (
  <View style={chartStyles.legend}>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#898989' }]} />
      <Text style={chartStyles.legendText}>In Situ/T1</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#7a7a7a' }]} />
      <Text style={chartStyles.legendText}>T2</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#a7a7a7' }]} />
      <Text style={chartStyles.legendText}>T3</Text>
    </View>
    <View style={chartStyles.legendItem}>
      <View style={[chartStyles.legendColor, { backgroundColor: '#777777' }]} />
      <Text style={chartStyles.legendText}>T4</Text>
    </View>
  </View>
);

/* PDF Bar Chart component */
const PDFBarChart = ({ label, rawValue, percentage, color, interpretation, tStage }) => (
  <View style={chartStyles.barChartRow}>
    <Text style={chartStyles.barLabel}>{String(label)}</Text>
    <Text style={[chartStyles.barCategoryValue, { color }]}>
      {String(rawValue)} {tStage ? `(${tStage})` : ''}
    </Text>
    <View style={chartStyles.barBackground}>
      <View style={[chartStyles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
    </View>
    <View style={chartStyles.barScale}>
      <Text style={[chartStyles.scaleItem, { color: '#898989' }]}>Tis</Text>
      <Text style={[chartStyles.scaleItem, { color: '#898989' }]}>T1</Text>
      <Text style={[chartStyles.scaleItem, { color: '#7a7a7a' }]}>T2</Text>
      <Text style={[chartStyles.scaleItem, { color: '#a7a7a7' }]}>T3</Text>
      <Text style={[chartStyles.scaleItem, { color: '#777777' }]}>T4</Text>
    </View>
    <Text style={[chartStyles.barInterpretation, { color }]}>{String(interpretation)}</Text>
  </View>
);

const SkinBiopsyReportsDocumentPDFTemplate = ({ document: data }) => {
  /* Handle wrapped collection format */
  let recordsArray;
  if (Array.isArray(data)) {
    recordsArray = data[0]?.skin_biopsy_reports || data;
  } else {
    recordsArray = data?.skin_biopsy_reports || (data?.documentData || data?.data || [data]);
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
          <Text style={styles.title}>Skin Biopsy Reports</Text>
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            {' | '}{recordsArray.length} record{recordsArray.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Records */}
        {recordsArray.map((record, idx) => {
          const hasBreslowData = typeof record.breslowThickness === 'number';
          let percentage = 0;
          if (hasBreslowData) {
            percentage = record.breslowThickness === 0 ? 15 : Math.min(100, Math.max(15, (record.breslowThickness / 5) * 100));
          }

          const mlcEntries = getMlcEntries(record.melanocyticLesionCharacteristics);

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  Skin Biopsy Report {idx + 1}
                </Text>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>

              {/* Bar Chart Section - Breslow Thickness */}
              {hasBreslowData && (
                <View style={chartStyles.chartSection} wrap={false}>
                  <Text style={styles.sectionTitle}>Staging</Text>
                  <PDFLegend />
                  <PDFBarChart
                    label="Breslow Thickness"
                    rawValue={`${record.breslowThickness} mm`}
                    percentage={percentage}
                    color={getBreslowColor(record.breslowThickness)}
                    interpretation={getBreslowInterpretation(record.breslowThickness)}
                    tStage={getTStage(record.breslowThickness)}
                  />
                </View>
              )}

              {/* General Information */}
              {(record.date || record.provider || record.facility || record.pathologistName) && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>General Information</Text>
                  <RenderFieldRow label="DATE" value={formatDate(record.date)} />
                  <RenderFieldRow label="PROVIDER" value={record.provider} />
                  <RenderFieldRow label="FACILITY" value={record.facility} />
                  <RenderFieldRow label="PATHOLOGIST" value={record.pathologistName} />
                </View>
              )}

              {/* Specimen Details */}
              {(record.specimenSite || record.biopsyTechnique || record.specimenSize) && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Specimen Details</Text>
                  <RenderFieldRow label="SPECIMEN SITE" value={record.specimenSite} />
                  <RenderFieldRow label="BIOPSY TECHNIQUE" value={record.biopsyTechnique} />
                  <RenderFieldRow label="SPECIMEN SIZE" value={record.specimenSize} />
                </View>
              )}

              {/* Clinical Indication */}
              {record.clinicalIndication && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Clinical Indication</Text>
                  <Text style={styles.listItem}>{String(record.clinicalIndication)}</Text>
                </View>
              )}

              {/* Histopathologic Diagnosis */}
              {record.histopathologicDiagnosis && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Histopathologic Diagnosis</Text>
                  <Text style={styles.diagnosisText}>{String(record.histopathologicDiagnosis)}</Text>
                </View>
              )}

              {/* Microscopy */}
              {(record.epidermisDescription || record.dermisDescription || record.subcutaneousTissueDescription) && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Microscopy</Text>
                  <RenderFieldRow label="EPIDERMIS" value={record.epidermisDescription} />
                  <RenderFieldRow label="DERMIS" value={record.dermisDescription} />
                  <RenderFieldRow label="SUBCUTANEOUS TISSUE" value={record.subcutaneousTissueDescription} />
                </View>
              )}

              {/* Staging Details */}
              {(record.clarkLevel || record.mitoticRate) && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Staging Details</Text>
                  {hasBreslowData && <RenderFieldRow label="BRESLOW THICKNESS" value={`${record.breslowThickness} mm`} />}
                  <RenderFieldRow label="CLARK LEVEL" value={record.clarkLevel} />
                  <RenderFieldRow label="MITOTIC RATE" value={record.mitoticRate} />
                </View>
              )}

              {/* Melanocytic Lesion Characteristics — dynamic-key object, render ALL keys */}
              {mlcEntries.length > 0 && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Melanocytic Lesion Characteristics</Text>
                  {mlcEntries.map(([k, v]) => (
                    <RenderFieldRow key={k} label={prettyKey(k).toUpperCase()} value={flattenMlcValue(v)} />
                  ))}
                </View>
              )}

              {/* Margins and Invasion */}
              {(record.marginStatus || record.ulcerationPresent || record.lymphovascularInvasion || record.perineuralInvasion || record.inflammatoryInfiltrate) && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Margins and Invasion</Text>
                  <RenderFieldRow label="MARGIN STATUS" value={record.marginStatus} />
                  <RenderFieldRow label="ULCERATION" value={record.ulcerationPresent} />
                  <RenderFieldRow label="LYMPHOVASCULAR INVASION" value={record.lymphovascularInvasion} />
                  <RenderFieldRow label="PERINEURAL INVASION" value={record.perineuralInvasion} />
                  <RenderFieldRow label="INFLAMMATORY INFILTRATE" value={record.inflammatoryInfiltrate} />
                </View>
              )}

              {/* Additional Microscopic Features */}
              {record.additionalMicroscopicFeatures && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Additional Microscopic Features</Text>
                  <Text style={styles.listItem}>{String(record.additionalMicroscopicFeatures)}</Text>
                </View>
              )}

              {/* Special Stains */}
              {record.specialStainsPerformed && record.specialStainsPerformed.length > 0 && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Special Stains</Text>
                  {record.specialStainsPerformed.map((item, i) => (
                    <Text key={i} style={styles.listItem}>{`${i + 1}. ${String(item)}`}</Text>
                  ))}
                </View>
              )}

              {/* Immunohistochemistry */}
              {record.immunohistochemistryResults && record.immunohistochemistryResults.length > 0 && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Immunohistochemistry</Text>
                  {record.immunohistochemistryResults.map((item, i) => (
                    <Text key={i} style={styles.listItem}>{`${i + 1}. ${String(item)}`}</Text>
                  ))}
                </View>
              )}

              {/* Molecular Testing */}
              {record.molecularTestingPerformed && record.molecularTestingPerformed.length > 0 && (
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Molecular Testing</Text>
                  {record.molecularTestingPerformed.map((item, i) => (
                    <Text key={i} style={styles.listItem}>{`${i + 1}. ${String(item)}`}</Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          IntelliCare - Skin Biopsy Reports
        </Text>
      </Page>
    </Document>
  );
};

export default SkinBiopsyReportsDocumentPDFTemplate;
