import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#000000'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  recordSeparator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottom: '2px solid #000000',
    paddingBottom: 4
  },
  recordHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6
  },
  fieldRow: {
    marginBottom: 0,
    flexDirection: 'row'
  },
  fieldLabel: {
    fontWeight: 'bold',
    marginRight: 0
  },
  fieldValue: {
    marginLeft: 2
  },
  line: {
    marginBottom: 2
  },
  emptyLine: {
    marginBottom: 6
  },
  indent: {
    marginLeft: 10
  },
  narrativeText: {
    marginLeft: 10,
    marginBottom: 4,
    lineHeight: 1.6
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#666666',
    borderTop: '1px solid #cccccc',
    paddingTop: 8,
    textAlign: 'center'
  },
  pageNumber: {
    position: 'absolute',
    bottom: 15,
    right: 40,
    fontSize: 9,
    color: '#666666'
  }
});

// Helper to filter nulls from arrays
const filterNulls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item !== null && item !== undefined);
};

// Format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
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

const IntraoperativeMonitoringPDFTemplate = ({ data, patientName }) => {
  // Handle data structure - extract array of monitoring records
  let monitoringRecords = [];
  if (Array.isArray(data)) {
    monitoringRecords = data;
  } else if (data.intraoperative_monitoring) {
    monitoringRecords = data.intraoperative_monitoring;
  } else if (data.data?.intraoperative_monitoring) {
    monitoringRecords = data.data.intraoperative_monitoring;
  } else {
    monitoringRecords = [data];
  }

  monitoringRecords = filterNulls(monitoringRecords);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Intraoperative Monitoring</Text>
        {patientName && (
          <Text style={{ textAlign: 'center', marginBottom: 16, fontSize: 12 }}>
            Patient: {patientName}
          </Text>
        )}

        {monitoringRecords.map((record, recordIdx) => (
          <View key={recordIdx} wrap={false}>
            {/* Record Separator (except first record) */}
            {recordIdx > 0 && <View style={styles.recordSeparator} />}

            {/* Record Header */}
            <View wrap={false}>
              <Text style={styles.recordHeader}>
                Monitoring Session {recordIdx + 1}
                {(record.procedureDate || record.date) &&
                  ` - ${formatDate(record.procedureDate || record.date)}`}
              </Text>
            </View>

            {/* SSEP Section */}
            {record.ssep && (record.ssep.baseline || record.ssep.finalReadings || record.ssep.abnormalities) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Somatosensory Evoked Potentials (SSEP)</Text>
                {record.ssep.baseline && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Baseline:</Text>
                    <Text style={styles.fieldValue}> {record.ssep.baseline}</Text>
                  </View>
                )}
                {record.ssep.finalReadings && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Final Readings:</Text>
                    <Text style={styles.fieldValue}> {record.ssep.finalReadings}</Text>
                  </View>
                )}
                {record.ssep.abnormalities && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Abnormalities:</Text>
                    <Text style={styles.fieldValue}> {record.ssep.abnormalities}</Text>
                  </View>
                )}
                <Text style={styles.emptyLine}></Text>
              </View>
            )}

            {/* MEP Section */}
            {record.mep && (record.mep.recommended || record.mep.indication) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Motor Evoked Potentials (MEP)</Text>
                {record.mep.recommended && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Recommended:</Text>
                    <Text style={styles.fieldValue}> {String(record.mep.recommended)}</Text>
                  </View>
                )}
                {record.mep.indication && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Indication:</Text>
                    <Text style={styles.fieldValue}> {record.mep.indication}</Text>
                  </View>
                )}
                <Text style={styles.emptyLine}></Text>
              </View>
            )}

            {/* Direct Stimulation Section */}
            {record.directStimulation && (record.directStimulation.motorMapping || record.directStimulation.languageMapping) && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Direct Cortical Stimulation</Text>
                {record.directStimulation.motorMapping && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Motor Mapping:</Text>
                    <Text style={styles.fieldValue}> {record.directStimulation.motorMapping}</Text>
                  </View>
                )}
                {record.directStimulation.languageMapping && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Language Mapping:</Text>
                    <Text style={styles.fieldValue}> {record.directStimulation.languageMapping}</Text>
                  </View>
                )}
                <Text style={styles.emptyLine}></Text>
              </View>
            )}

            {/* EEG Section */}
            {record.eeg && record.eeg.findings && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Electroencephalography (EEG)</Text>
                <Text style={styles.narrativeText}>{record.eeg.findings}</Text>
                <Text style={styles.emptyLine}></Text>
              </View>
            )}

            {/* EMG Section */}
            {record.emg && record.emg.activity && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Electromyography (EMG)</Text>
                <Text style={styles.narrativeText}>{record.emg.activity}</Text>
                <Text style={styles.emptyLine}></Text>
              </View>
            )}

            {/* Mapping Results */}
            {record.mappingResults && filterNulls(record.mappingResults).length > 0 && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>
                  Mapping Results ({filterNulls(record.mappingResults).length})
                </Text>
                {filterNulls(record.mappingResults).map((result, idx) => (
                  <Text key={idx} style={[styles.line, styles.indent]}>
                    • {result}
                  </Text>
                ))}
                <Text style={styles.emptyLine}></Text>
              </View>
            )}

            {/* Alerts */}
            {record.alerts && filterNulls(record.alerts).length > 0 && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>
                  Alerts ({filterNulls(record.alerts).length})
                </Text>
                {filterNulls(record.alerts).map((alert, idx) => (
                  <Text key={idx} style={[styles.line, styles.indent]}>
                    • {alert}
                  </Text>
                ))}
                <Text style={styles.emptyLine}></Text>
              </View>
            )}

            {/* Changes */}
            {record.changes && filterNulls(record.changes).length > 0 && (
              <View wrap={false}>
                <Text style={styles.sectionTitle}>
                  Changes Documented ({filterNulls(record.changes).length})
                </Text>
                {filterNulls(record.changes).map((change, idx) => (
                  <Text key={idx} style={[styles.line, styles.indent]}>
                    • {change}
                  </Text>
                ))}
                <Text style={styles.emptyLine}></Text>
              </View>
            )}

            {/* Monitored By */}
            {record.monitoredBy && (
              <View wrap={false}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Monitored By:</Text>
                  <Text style={styles.fieldValue}> {record.monitoredBy}</Text>
                </View>
                <Text style={styles.emptyLine}></Text>
              </View>
            )}
          </View>
        ))}

        <Text style={styles.footer}>
          PROTECTED HEALTH INFORMATION (PHI) - Handle according to HIPAA regulations
        </Text>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `Page ${pageNumber} of ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default IntraoperativeMonitoringPDFTemplate;
