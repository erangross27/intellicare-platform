import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// December 2025 Standards: Helvetica font, large readable fonts, black & white
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 20,
  },
  recordTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 8,
    marginTop: 12,
  },
  item: {
    fontSize: 11,
    color: '#000000',
    marginBottom: 4,
    marginLeft: 12,
  },
  subItem: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 2,
    marginLeft: 24,
  },
  medicationCard: {
    border: '1pt solid #000000',
    borderRadius: 4,
    marginBottom: 10,
    marginLeft: 12,
    marginRight: 12,
  },
  medicationHeader: {
    backgroundColor: '#f0f0f0',
    padding: '8 12',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  medicationTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  medicationBody: {
    padding: '8 12',
  },
  medicationRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  medicationFieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 60,
    flexShrink: 0,
  },
  medicationFieldValue: {
    fontSize: 10,
    color: '#000000',
    flex: 1,
  },
  noData: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
});

// Safe string conversion - handles arrays WITHOUT JSON.stringify brackets
const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Format date helper
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue);
  }
};

// Flatten object for PDF
const flattenObject = (obj) => {
  if (!obj || typeof obj !== 'object') return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      if (typeof value === 'boolean') {
        items.push({ label, value: value ? 'Yes' : 'No' });
      } else if (Array.isArray(value)) {
        items.push({ label, value: value.filter(Boolean).join(', ') });
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue !== null && subValue !== undefined && subValue !== '') {
            const subLabel = `${label} - ${subKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}`;
            items.push({ label: subLabel, value: String(subValue) });
          }
        });
      } else {
        items.push({ label, value: String(value) });
      }
    }
  });
  return items;
};

const HypertensiveNephropathyDocumentPDFTemplate = ({ document }) => {
  const records = Array.isArray(document) ? document : [document];
  const validRecords = records.filter(r => r && typeof r === 'object');

  if (validRecords.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Hypertensive Nephropathy</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Hypertensive Nephropathy</Text>

        {validRecords.map((record, idx) => (
          <View key={idx}>
            <Text style={styles.recordTitle}>Record {idx + 1}</Text>

            {/* Record Information Section */}
            {(record.date || record.provider || record.facility || record.status) && (
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>Record Information</Text>
                {record.date && <Text style={styles.item}>Date: {formatDate(record.date)}</Text>}
                {record.provider && <Text style={styles.item}>Provider: {toSafeString(record.provider)}</Text>}
                {record.facility && <Text style={styles.item}>Facility: {toSafeString(record.facility)}</Text>}
                {record.status && <Text style={styles.item}>Status: {toSafeString(record.status)}</Text>}
              </View>
            )}

            {/* Target Organ Damage Section */}
            {record.targetOrganDamage && record.targetOrganDamage.length > 0 && (
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>Target Organ Damage</Text>
                {record.targetOrganDamage.map((damage, dIdx) => (
                  <Text key={dIdx} style={styles.item}>{dIdx + 1}. {toSafeString(damage)}</Text>
                ))}
              </View>
            )}

            {/* Blood Pressure Control Section */}
            {record.bloodPressureControl && (() => {
              const bpc = record.bloodPressureControl;
              const hasBPCData = bpc.current || bpc.target || bpc.homeReadings?.length || bpc.ambulatoryMonitoring;
              if (!hasBPCData) return null;

              const amItems = bpc.ambulatoryMonitoring ? flattenObject(bpc.ambulatoryMonitoring) : [];

              return (
                <View wrap={false} minPresenceAhead={40}>
                  <Text style={styles.sectionTitle}>Blood Pressure Control</Text>
                  {bpc.current && <Text style={styles.item}>Current: {toSafeString(bpc.current)}</Text>}
                  {bpc.target && <Text style={styles.item}>Target: {toSafeString(bpc.target)}</Text>}
                  {bpc.homeReadings?.length > 0 && (
                    <Text style={styles.item}>Home Readings: {bpc.homeReadings.join(', ')}</Text>
                  )}
                  {amItems.length > 0 && (
                    <>
                      <Text style={styles.item}>Ambulatory Monitoring:</Text>
                      {amItems.map((item, iIdx) => (
                        <Text key={iIdx} style={styles.subItem}>{item.label}: {toSafeString(item.value)}</Text>
                      ))}
                    </>
                  )}
                </View>
              );
            })()}

            {/* Medications Section */}
            {record.medications && record.medications.length > 0 && (
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>Medications</Text>
                {record.medications.map((med, mIdx) => (
                  <View key={mIdx} style={styles.medicationCard} wrap={false}>
                    <View style={styles.medicationHeader}>
                      <Text style={styles.medicationTitle}>Medication {mIdx + 1}</Text>
                    </View>
                    <View style={styles.medicationBody}>
                      {med.class && (
                        <View style={styles.medicationRow}>
                          <Text style={styles.medicationFieldLabel}>Class:</Text>
                          <Text style={styles.medicationFieldValue}>{toSafeString(med.class)}</Text>
                        </View>
                      )}
                      {med.agent && (
                        <View style={styles.medicationRow}>
                          <Text style={styles.medicationFieldLabel}>Agent:</Text>
                          <Text style={styles.medicationFieldValue}>{toSafeString(med.agent)}</Text>
                        </View>
                      )}
                      {med.dose && (
                        <View style={styles.medicationRow}>
                          <Text style={styles.medicationFieldLabel}>Dose:</Text>
                          <Text style={styles.medicationFieldValue}>{toSafeString(med.dose)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Findings Section */}
            {record.findings && (
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <Text style={styles.item}>{toSafeString(record.findings)}</Text>
              </View>
            )}

            {/* Assessment Section */}
            {record.assessment && (
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <Text style={styles.item}>{toSafeString(record.assessment)}</Text>
              </View>
            )}

            {/* Plan Section */}
            {record.plan && (
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>Plan</Text>
                <Text style={styles.item}>{toSafeString(record.plan)}</Text>
              </View>
            )}

            {/* Recommendations Section */}
            {record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {record.recommendations.map((rec, rIdx) => {
                  const recText = typeof rec === 'string' ? rec : (rec?.recommendation || '');
                  const dateText = typeof rec === 'object' && rec?.date ? ` (${formatDate(rec.date)})` : '';
                  return (
                    <Text key={rIdx} style={styles.item}>{rIdx + 1}. {toSafeString(recText)}{dateText}</Text>
                  );
                })}
              </View>
            )}

            {/* Results Section */}
            {record.results && (() => {
              const resultItems = flattenObject(record.results);
              if (resultItems.length === 0) return null;
              return (
                <View wrap={false} minPresenceAhead={40}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {resultItems.map((item, iIdx) => (
                    <Text key={iIdx} style={styles.item}>{iIdx + 1}. {toSafeString(item.label)}: {toSafeString(item.value)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Notes Section */}
            {record.notes && (
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.item}>{toSafeString(record.notes)}</Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default HypertensiveNephropathyDocumentPDFTemplate;
