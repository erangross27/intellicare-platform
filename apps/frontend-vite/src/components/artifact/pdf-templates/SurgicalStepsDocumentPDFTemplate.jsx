import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PDF styles — March 2026 standard (Helvetica, LETTER, 20pt title / 12pt body)
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
    size: 'LETTER',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#404040',
    paddingBottom: 8,
  },
  recordCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 16,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 6,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#404040',
  },
  fieldBlock: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
    color: '#4b5563',
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    color: '#1f2937',
  },
  listItem: {
    fontSize: 12,
    paddingLeft: 8,
    marginBottom: 4,
    lineHeight: 1.4,
  },
});

const SurgicalStepsDocumentPDFTemplate = ({ document }) => {
  // Data unwrapping
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.records) {
      records = document[0].records;
    } else if (document.length > 0 && document[0]?._records) {
      records = document[0]._records;
    } else {
      records = document;
    }
  } else if (document?.records) {
    records = document.records;
  } else if (document?._records) {
    records = document._records;
  } else if (document) {
    records = [document];
  }

  const validRecords = Array.isArray(records) ? records : [];

  // Safe string conversion
  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object') {
      if (Object.keys(val).length === 0) return '';
      if (val.value !== undefined) return String(val.value);
      if (val.text !== undefined) return String(val.text);
      return JSON.stringify(val);
    }
    return String(val);
  };

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const dateStr = dateValue.$date || dateValue;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateValue || '');
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateValue || '');
    }
  };

  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Surgical Steps</Text>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>No surgical steps data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Surgical Steps</Text>

        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            <Text style={styles.recordTitle}>{String(safeString(record.procedureName) || `Surgical Steps ${idx + 1}`)}</Text>

            {/* Procedure Information Section */}
            {(record.date || record.procedureName || record.status || record.facility) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Procedure Information</Text>
                {record.date && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Date</Text>
                    <Text style={styles.fieldValue}>{String(formatDate(record.date))}</Text>
                  </View>
                )}
                {record.procedureName && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Procedure Name</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.procedureName))}</Text>
                  </View>
                )}
                {record.status && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Status</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.status))}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Facility</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.facility))}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Surgical Team Section */}
            {(record.surgeon || (record.assistants && record.assistants.length > 0)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Surgical Team</Text>
                {record.surgeon && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Surgeon</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.surgeon))}</Text>
                  </View>
                )}
                {record.assistants && record.assistants.length > 0 && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Assistants</Text>
                    {record.assistants.map((assistant, aIdx) => (
                      <Text key={aIdx} style={styles.listItem}>{`${aIdx + 1}. ${String(safeString(assistant))}`}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Technique and Approach Section */}
            {(record.technique || record.approach || record.anatomicalLocation) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Technique and Approach</Text>
                {record.technique && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Technique</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.technique))}</Text>
                  </View>
                )}
                {record.approach && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Approach</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.approach))}</Text>
                  </View>
                )}
                {record.anatomicalLocation && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Anatomical Location</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.anatomicalLocation))}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Step Description Section */}
            {(record.stepNumber || record.stepDescription) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Step Description</Text>
                {record.stepNumber && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Step Number</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.stepNumber))}</Text>
                  </View>
                )}
                {record.stepDescription && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Description</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.stepDescription))}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Equipment and Instruments Section */}
            {((record.equipmentUsed && record.equipmentUsed.length > 0) || (record.instrumentsUsed && record.instrumentsUsed.length > 0)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Equipment and Instruments</Text>
                {record.equipmentUsed && record.equipmentUsed.length > 0 && (
                  <View style={styles.fieldBlock} wrap={false}>
                    <Text style={styles.fieldSubtitle}>Equipment Used</Text>
                    {record.equipmentUsed.map((equip, eIdx) => (
                      <Text key={eIdx} style={styles.listItem}>{`${eIdx + 1}. ${String(safeString(equip))}`}</Text>
                    ))}
                  </View>
                )}
                {record.instrumentsUsed && record.instrumentsUsed.length > 0 && (
                  <View style={styles.fieldBlock} wrap={false}>
                    <Text style={styles.fieldSubtitle}>Instruments Used</Text>
                    {record.instrumentsUsed.map((inst, iIdx) => (
                      <Text key={iIdx} style={styles.listItem}>{`${iIdx + 1}. ${String(safeString(inst))}`}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Procedure Details Section */}
            {(record.duration || record.bloodLoss || (record.tissuesInvolved && record.tissuesInvolved.length > 0)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Procedure Details</Text>
                {record.duration && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Duration</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.duration))}</Text>
                  </View>
                )}
                {record.bloodLoss && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Blood Loss</Text>
                    <Text style={styles.fieldValue}>{String(safeString(record.bloodLoss))}</Text>
                  </View>
                )}
                {record.tissuesInvolved && record.tissuesInvolved.length > 0 && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>Tissues Involved</Text>
                    {record.tissuesInvolved.map((tissue, tIdx) => (
                      <Text key={tIdx} style={styles.listItem}>{`${tIdx + 1}. ${String(safeString(tissue))}`}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Findings Section */}
            {record.findings && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <Text style={styles.listItem}>{String(safeString(record.findings))}</Text>
              </View>
            )}

            {/* Specimens Section */}
            {record.specimens && record.specimens.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Specimens</Text>
                {record.specimens.map((specimen, sIdx) => (
                  <Text key={sIdx} style={styles.listItem}>{`${sIdx + 1}. ${String(safeString(specimen))}`}</Text>
                ))}
              </View>
            )}

            {/* Complications Section */}
            {record.complications && record.complications.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Complications</Text>
                {record.complications.map((complication, cIdx) => (
                  <Text key={cIdx} style={styles.listItem}>{`${cIdx + 1}. ${String(safeString(complication))}`}</Text>
                ))}
              </View>
            )}

            {/* Safety Checks Section */}
            {record.safetyChecks && record.safetyChecks.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Safety Checks</Text>
                {record.safetyChecks.map((check, chkIdx) => (
                  <Text key={chkIdx} style={styles.listItem}>{`${chkIdx + 1}. ${String(safeString(check))}`}</Text>
                ))}
              </View>
            )}

            {/* Anesthesia Events Section */}
            {record.anesthesiaEvents && record.anesthesiaEvents.length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Anesthesia Events</Text>
                {record.anesthesiaEvents.map((event, evtIdx) => (
                  <Text key={evtIdx} style={styles.listItem}>{`${evtIdx + 1}. ${String(safeString(event))}`}</Text>
                ))}
              </View>
            )}

            {/* Notes Section */}
            {record.notes && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.listItem}>{String(safeString(record.notes))}</Text>
              </View>
            )}

            {/* Operative Report Section */}
            {record.operativeReport && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Operative Report</Text>
                <Text style={styles.listItem}>{String(safeString(record.operativeReport))}</Text>
              </View>
            )}

            {/* Images Section */}
            {record.images && record.images.length > 0 && (
              <View style={styles.section} wrap={record.images.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Images</Text>
                {record.images.map((image, imgIdx) => (
                  <Text key={imgIdx} style={styles.listItem}>{`${imgIdx + 1}. ${String(safeString(image))}`}</Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SurgicalStepsDocumentPDFTemplate;
