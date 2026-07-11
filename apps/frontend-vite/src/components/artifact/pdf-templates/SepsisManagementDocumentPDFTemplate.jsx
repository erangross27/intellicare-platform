import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Sepsis Management Document PDF Template - March 2026
 * Helvetica font, LETTER size, 20pt title / 12pt body
 * Professional black & white layout with bar chart for lab values
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    paddingBottom: 14,
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  documentSubtitle: {
    fontSize: 10,
    color: '#555555',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Helvetica',
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 16,
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderLeftWidth: 5,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordMeta: {
    fontSize: 10,
    marginTop: 6,
    color: '#333333',
    fontFamily: 'Helvetica',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 10,
  },
  fieldBox: {
    borderWidth: 1,
    borderColor: '#cccccc',
    marginBottom: 6,
    padding: 8,
    paddingBottom: 6,
    backgroundColor: '#fafafa',
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#555555',
    paddingLeft: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  numberedItem: {
    flexDirection: 'row',
    paddingLeft: 10,
    marginBottom: 3,
  },
  itemNumber: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 22,
  },
  itemContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
    lineHeight: 1.5,
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    paddingTop: 6,
  },
  /* Bar Chart Styles */
  chartContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
    padding: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 8,
    color: '#555555',
    fontFamily: 'Helvetica',
  },
  barChartRow: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBackground: {
    flex: 1,
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#d1d5db',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barValue: {
    fontSize: 10,
    color: '#000000',
    fontFamily: 'Helvetica',
    minWidth: 80,
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return String(dateString); }
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return String(dateString); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return '';
  return String(val);
};

const safeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v !== null && v !== undefined && v !== '');
  return [];
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') return val.trim() !== '';
  return true;
};

/* ========== BAR CHART HELPERS ========== */
const LAB_RANGES = {
  lactate: { low: 0.5, high: 2.0, scale: [0, 15] },
  procalcitonin: { low: 0, high: 0.5, scale: [0, 50] },
  wbc: { low: 4500, high: 11000, scale: [0, 40000] },
};

const getLabBarColorPDF = (value, testType) => {
  if (value === null || value === undefined) return '#999999';
  const range = LAB_RANGES[testType];
  if (!range) return '#999999';
  if (value < range.low) return '#606060';
  if (value > range.high) return '#5c5c5c';
  return '#6f6f6f';
};

const getLabInterpretation = (value, testType) => {
  if (value === null || value === undefined) return '';
  const range = LAB_RANGES[testType];
  if (!range) return '';
  if (value < range.low) return testType === 'wbc' ? 'Leukopenia' : 'Normal';
  if (value > range.high) return testType === 'wbc' ? 'Leukocytosis' : 'Elevated';
  return 'Normal';
};

const labToPercentage = (value, testType) => {
  const range = LAB_RANGES[testType];
  if (!range) return 50;
  const [min, max] = range.scale;
  return Math.max(5, Math.min(100, ((value - min) / (max - min)) * 100));
};

const stripNumber = (text) => {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/^\d+[\.\)]\s*/, '');
};

const parseSubtitleItems = (text) => {
  if (!text) return [];
  const segments = text.split(/(?<!(?:Dr|Mr|Mrs|Ms|Jr|Sr|St|vs|etc)\.)(?<=\.)\s+(?=[A-Z])/).filter(s => s.trim());
  if (segments.length === 0) return [];
  return segments.map((segment) => {
    const colonMatch = segment.match(/^([^:]+?):\s*(.+)$/s);
    if (colonMatch && colonMatch[1].length < 80) {
      return { label: colonMatch[1].trim(), value: colonMatch[2].trim().replace(/\.$/, ''), isGeneric: false };
    }
    return { label: '', value: segment.trim().replace(/\.$/, ''), isGeneric: true };
  });
};

const SepsisManagementDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.sepsis_management) return templateData.sepsis_management;
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.sepsis_management) return docData.sepsis_management;
      return [docData];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sepsis Management</Text>
          </View>
          <Text style={styles.noData}>No sepsis management data available</Text>
        </Page>
      </Document>
    );
  }

  const renderFieldSection = (title, entries) => {
    const valid = entries
      .filter(([, val]) => typeof val === 'boolean' ? true : hasValue(val))
      .map(([label, val]) => [label, typeof val === 'boolean' ? (val ? 'Yes' : 'No') : safeString(val)]);
    if (valid.length === 0) return null;
    return (
      <View style={styles.section} wrap={valid.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {valid.map(([label, val], i) => {
          const subItems = parseSubtitleItems(val);
          if (subItems.length > 1) {
            return (
              <View key={i} style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>{label}</Text>
                {subItems.map((item, j) => (
                  <View key={j}>
                    {!item.isGeneric && <Text style={styles.subLabel}>{item.label}</Text>}
                    <View style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{j + 1}.</Text>
                      <Text style={styles.itemContent}>{item.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <View key={i} style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <View style={styles.numberedItem}>
                <Text style={styles.itemNumber}>1.</Text>
                <Text style={styles.itemContent}>{val}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Sepsis Management</Text>
          <Text style={styles.documentSubtitle}>Clinical Sepsis Management Report</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={80}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Record {idx + 1}</Text>
              {(record.date || record.createdAt) && (
                <Text style={styles.recordMeta}>Date: {formatDate(record.date || record.createdAt)}</Text>
              )}
              {record.sepsisSeverity && (
                <Text style={styles.recordMeta}>Severity: {record.sepsisSeverity}</Text>
              )}
            </View>

            {/* Section 1: Sepsis Assessment */}
            {renderFieldSection('Sepsis Assessment', [
              ['Severity', record.sepsisSeverity],
              ['qSOFA Score', record.qsofaScore],
              ['SOFA Score', record.sofaScore],
              ['Onset Date/Time', record.sepsisOnsetDateTime ? formatDateTime(record.sepsisOnsetDateTime) : null],
            ])}

            {/* Section 2: Infection Source & Cultures */}
            {(() => {
              const fieldEntries = [
                ['Suspected Infection Source', record.suspectedInfectionSource],
                ['Blood Culture Collection Time', record.bloodCultureCollectionTime ? formatDateTime(record.bloodCultureCollectionTime) : null],
              ].filter(([, v]) => hasValue(v));
              const cultureResults = safeArray(record.bloodCultureResults);
              const totalItems = fieldEntries.length + cultureResults.length;
              if (totalItems === 0) return null;
              return (
                <View style={styles.section} wrap={totalItems > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Infection Source & Cultures</Text>
                  {fieldEntries.map(([label, val], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>1.</Text>
                        <Text style={styles.itemContent}>{safeString(val)}</Text>
                      </View>
                    </View>
                  ))}
                  {cultureResults.length > 0 && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Blood Culture Results</Text>
                      {cultureResults.map((item, i) => (
                        <View key={i} style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{i + 1}.</Text>
                          <Text style={styles.itemContent}>{stripNumber(safeString(item))}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Section 3: Laboratory Values (Bar Chart) */}
            {(() => {
              const labItems = [
                { label: 'Initial Lactate Level', value: record.initialLactateLevel, unit: 'mmol/L', testType: 'lactate' },
                { label: 'Repeat Lactate Level', value: record.repeatLactateLevel, unit: 'mmol/L', testType: 'lactate' },
                { label: 'Procalcitonin Level', value: record.procalcitoninLevel, unit: 'ng/mL', testType: 'procalcitonin' },
                { label: 'White Blood Cell Count', value: record.whiteBloodCellCount, unit: 'cells/uL', testType: 'wbc' },
              ].filter(item => item.value != null);
              if (labItems.length === 0) return null;
              return (
                <View style={styles.section} wrap={labItems.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Laboratory Values</Text>
                  <View style={styles.chartContainer}>
                    <View style={styles.chartLegend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#6f6f6f' }]} />
                        <Text style={styles.legendText}>Normal</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#606060' }]} />
                        <Text style={styles.legendText}>Low</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#5c5c5c' }]} />
                        <Text style={styles.legendText}>High</Text>
                      </View>
                    </View>
                    {labItems.map((item, i) => {
                      const numVal = Number(item.value);
                      const color = getLabBarColorPDF(numVal, item.testType);
                      const interpretation = getLabInterpretation(numVal, item.testType);
                      const pct = labToPercentage(numVal, item.testType);
                      const displayVal = item.testType === 'wbc'
                        ? `${Number(numVal).toLocaleString()} ${item.unit}`
                        : `${numVal} ${item.unit}`;
                      return (
                        <View key={i} style={styles.barChartRow}>
                          <Text style={styles.barLabel}>{item.label}</Text>
                          <View style={styles.barContainer}>
                            <View style={styles.barBackground}>
                              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                            </View>
                            <Text style={styles.barValue}>{displayVal}</Text>
                          </View>
                          {interpretation ? (
                            <Text style={[styles.barInterpretation, { color }]}>{interpretation}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {/* Section 4: Antibiotic Therapy */}
            {(() => {
              const fieldEntries = [
                ['Antibiotic Administration Time', record.antibioticAdministrationTime ? formatDateTime(record.antibioticAdministrationTime) : null],
                ['Time to Antibiotics', record.timeToAntibiotics != null ? `${record.timeToAntibiotics} minutes` : null],
              ].filter(([, v]) => hasValue(v));
              const regimen = safeArray(record.empiricAntibioticRegimen);
              const totalItems = fieldEntries.length + regimen.length;
              if (totalItems === 0) return null;
              return (
                <View style={styles.section} wrap={totalItems > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Antibiotic Therapy</Text>
                  {fieldEntries.map(([label, val], i) => (
                    <View key={i} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>1.</Text>
                        <Text style={styles.itemContent}>{safeString(val)}</Text>
                      </View>
                    </View>
                  ))}
                  {regimen.length > 0 && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Empiric Antibiotic Regimen</Text>
                      {regimen.map((item, i) => (
                        <View key={i} style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{i + 1}.</Text>
                          <Text style={styles.itemContent}>{stripNumber(safeString(item))}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Section 5: Fluid Resuscitation & Hemodynamics */}
            {renderFieldSection('Fluid Resuscitation & Hemodynamics', [
              ['Initial Fluid Bolus', record.initialFluidBolus != null ? `${Number(record.initialFluidBolus).toLocaleString()} mL` : null],
              ['Fluid Resuscitation Complete Time', record.fluidResuscitationCompleteTime ? formatDateTime(record.fluidResuscitationCompleteTime) : null],
              ['Vasopressor Required', record.vasopressorRequired],
              ['Vasopressor Agent', record.vasopressorAgent],
              ['Vasopressor Start Time', record.vasopressorStartTime ? formatDateTime(record.vasopressorStartTime) : null],
              ['Mean Arterial Pressure', (record.meanArterialPressure != null && Number(record.meanArterialPressure) !== 0) ? `${record.meanArterialPressure} mmHg` : null],
            ])}

            {/* Section 6: Organ Dysfunction */}
            {(() => {
              const organSites = safeArray(record.organDysfunctionSites);
              const fieldEntries = [
                ['Mechanical Ventilation Required', record.mechanicalVentilationRequired],
                ['Renal Replacement Therapy', record.renalReplacementTherapy],
              ].filter(([, v]) => typeof v === 'boolean');
              const totalItems = organSites.length + fieldEntries.length;
              if (totalItems === 0) return null;
              return (
                <View style={styles.section} wrap={totalItems > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Organ Dysfunction</Text>
                  {organSites.length > 0 && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Organ Dysfunction Sites</Text>
                      {organSites.map((site, i) => (
                        <View key={i} style={styles.numberedItem}>
                          <Text style={styles.itemNumber}>{i + 1}.</Text>
                          <Text style={styles.itemContent}>{stripNumber(safeString(site))}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {fieldEntries.map(([label, val], i) => (
                    <View key={`f-${i}`} style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <View style={styles.numberedItem}>
                        <Text style={styles.itemNumber}>1.</Text>
                        <Text style={styles.itemContent}>{val ? 'Yes' : 'No'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Section 7: Bundle Compliance */}
            {renderFieldSection('Bundle Compliance', [
              ['3-Hour Bundle Compliance', record.sepsisBundle3HourCompliance],
              ['6-Hour Bundle Compliance', record.sepsisBundle6HourCompliance],
            ])}
          </View>
        ))}

        <Text style={styles.footer}>Confidential Medical Document</Text>
      </Page>
    </Document>
  );
};

export default SepsisManagementDocumentPDFTemplate;
