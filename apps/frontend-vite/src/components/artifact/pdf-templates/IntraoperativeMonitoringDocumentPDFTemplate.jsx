/**
 * IntraoperativeMonitoringDocumentPDFTemplate.jsx
 * December 2025 - BLACK AND WHITE PDF template
 * - Helvetica font, 14pt minimum for body text
 * - wrap={false} per section based on size
 * - Sections: Procedure Info, Timing, Neuromonitoring, Anesthesia, Fluid/Blood, Medications, Adverse Events
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PDF Styles - BLACK AND WHITE ONLY
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
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#000000',
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 4,
    color: '#000000',
  },
  fieldContainer: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 6,
    paddingLeft: 12,
    lineHeight: 1.4,
  },
  recordMeta: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  separator: {
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    marginTop: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 16,
  },
  groupContainer: {
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#000000',
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
  },
  objectFieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 12,
  },
  objectFieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginRight: 8,
  },
  objectFieldValue: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
});

// Helper: Safe string for Helvetica font (handle Unicode characters)
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  return str;
};

// Format date helper
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return safeString(dateValue);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return safeString(dateValue);
  }
};

// Format time helper
const formatTime = (timeValue) => {
  if (!timeValue) return '';
  try {
    if (typeof timeValue === 'string' && timeValue.includes('T')) {
      const date = new Date(timeValue);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      }
    }
    return safeString(timeValue);
  } catch (e) {
    return safeString(timeValue);
  }
};

// Helper: Render object fields
const renderObjectFields = (obj, excludeFields = []) => {
  if (!obj || typeof obj !== 'object') return null;
  const entries = Object.entries(obj).filter(([key, val]) =>
    val !== null && val !== undefined && val !== '' && !excludeFields.includes(key)
  );
  if (entries.length === 0) return null;

  return entries.map(([key, val], idx) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    return (
      <View key={idx} style={styles.objectFieldRow}>
        <Text style={styles.objectFieldLabel}>{label}:</Text>
        <Text style={styles.objectFieldValue}>{safeString(typeof val === 'object' ? JSON.stringify(val) : val)}</Text>
      </View>
    );
  });
};

const IntraoperativeMonitoringDocumentPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  // Unwrap data
  const unwrappedData = (() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.document?.intraoperative_monitoring) return item.document.intraoperative_monitoring;
        if (item?.intraoperative_monitoring) return item.intraoperative_monitoring;
        return item;
      });
    }
    if (templateData?.document?.intraoperative_monitoring) return templateData.document.intraoperative_monitoring;
    if (templateData?.intraoperative_monitoring) return templateData.intraoperative_monitoring;
    return [templateData];
  })();

  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Intraoperative Monitoring</Text>
          <Text style={styles.fieldValue}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Intraoperative Monitoring</Text>

        {unwrappedData.map((record, idx) => (
          <View key={idx}>
            {idx > 0 && <View style={styles.separator} />}

            <Text style={styles.recordTitle}>Intraoperative Monitoring {idx + 1}</Text>

            {record.createdAt && (
              <Text style={styles.recordMeta}>
                Date: {formatDate(record.createdAt)}
              </Text>
            )}

            {/* Procedure Information */}
            {(record.procedureType || record.anesthesiaType || record.asaClassification || record.surgicalPosition) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Procedure Information</Text>
                {record.procedureType && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Procedure Type</Text>
                    <Text style={styles.fieldValue}>{safeString(record.procedureType)}</Text>
                  </View>
                )}
                {record.anesthesiaType && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Anesthesia Type</Text>
                    <Text style={styles.fieldValue}>{safeString(record.anesthesiaType)}</Text>
                  </View>
                )}
                {record.asaClassification && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>ASA Classification</Text>
                    <Text style={styles.fieldValue}>{safeString(record.asaClassification)}</Text>
                  </View>
                )}
                {record.surgicalPosition && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Surgical Position</Text>
                    <Text style={styles.fieldValue}>{safeString(record.surgicalPosition)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Timing */}
            {(record.date || record.inductionTime || record.intubationTime || record.incisionTime || record.emergenceTime || record.extubationTime) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Timing</Text>
                {record.date && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Procedure Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                  </View>
                )}
                {record.inductionTime && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Induction Time</Text>
                    <Text style={styles.fieldValue}>{formatTime(record.inductionTime)}</Text>
                  </View>
                )}
                {record.intubationTime && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Intubation Time</Text>
                    <Text style={styles.fieldValue}>{formatTime(record.intubationTime)}</Text>
                  </View>
                )}
                {record.incisionTime && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Incision Time</Text>
                    <Text style={styles.fieldValue}>{formatTime(record.incisionTime)}</Text>
                  </View>
                )}
                {record.emergenceTime && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Emergence Time</Text>
                    <Text style={styles.fieldValue}>{formatTime(record.emergenceTime)}</Text>
                  </View>
                )}
                {record.extubationTime && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Extubation Time</Text>
                    <Text style={styles.fieldValue}>{formatTime(record.extubationTime)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Neuromonitoring */}
            {(record.neuromonitoringModality?.length > 0 || record.bisValue?.length > 0) && (
              <View style={styles.section} wrap={(record.neuromonitoringModality?.length || 0) + (record.bisValue?.length || 0) > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Neuromonitoring</Text>

                {/* Neuromonitoring Modalities */}
                {record.neuromonitoringModality?.length > 0 && (
                  <View style={styles.groupContainer}>
                    <Text style={styles.groupTitle}>Neuromonitoring Modality</Text>
                    {record.neuromonitoringModality.map((modality, mIdx) => {
                      if (modality && typeof modality === 'object') {
                        const t = Object.entries(modality).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' | ');
                        return <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {safeString(t)}</Text>;
                      }
                      return <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {safeString(modality)}</Text>;
                    })}
                  </View>
                )}

                {/* BIS Value */}
                {record.bisValue?.length > 0 && (
                  <View style={styles.groupContainer}>
                    <Text style={styles.groupTitle}>BIS Value</Text>
                    {record.bisValue.map((bis, bIdx) => {
                      if (bis && typeof bis === 'object') {
                        const bisText = [bis.time && `Time: ${formatTime(bis.time)}`, bis.value !== undefined && `Value: ${bis.value}`].filter(Boolean).join(' | ');
                        return <Text key={bIdx} style={styles.listItem}>{bIdx + 1}. {safeString(bisText || JSON.stringify(bis))}</Text>;
                      }
                      return <Text key={bIdx} style={styles.listItem}>{bIdx + 1}. {safeString(bis)}</Text>;
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Anesthesia Management */}
            {(record.ventilationMode || record.airwayManagement || record.anestheticAgents?.length > 0 || record.neuromuscularBlockade || record.temperatureManagement) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} wrap={false}>Anesthesia Management</Text>

                {/* Ventilation Mode */}
                {record.ventilationMode && (
                  <View style={styles.fieldContainer} wrap={false}>
                    <Text style={styles.fieldLabel}>Ventilation Mode</Text>
                    <Text style={styles.fieldValue}>{safeString(record.ventilationMode)}</Text>
                  </View>
                )}

                {/* Airway Management */}
                {record.airwayManagement && (
                  <View style={styles.fieldContainer} wrap={false}>
                    <Text style={styles.fieldLabel}>Airway Management</Text>
                    <Text style={styles.fieldValue}>{safeString(record.airwayManagement)}</Text>
                  </View>
                )}

                {/* Anesthetic Agents */}
                {record.anestheticAgents?.length > 0 && (
                  <View style={styles.groupContainer}>
                    <Text style={styles.groupTitle}>Anesthetic Agents</Text>
                    {record.anestheticAgents.map((agent, aIdx) => {
                      if (typeof agent === 'object') {
                        const agentText = [agent.agent, agent.dose, agent.route].filter(Boolean).join(' - ');
                        return <Text key={aIdx} style={styles.listItem}>{aIdx + 1}. {safeString(agentText)}</Text>;
                      }
                      return <Text key={aIdx} style={styles.listItem}>{aIdx + 1}. {safeString(agent)}</Text>;
                    })}
                  </View>
                )}

                {/* Neuromuscular Blockade */}
                {record.neuromuscularBlockade && (
                  <View style={styles.groupContainer}>
                    <Text style={styles.groupTitle}>Neuromuscular Blockade</Text>
                    {renderObjectFields(record.neuromuscularBlockade)}
                  </View>
                )}

                {/* Temperature Management */}
                {record.temperatureManagement && (
                  <View style={styles.groupContainer}>
                    <Text style={styles.groupTitle}>Temperature Management</Text>
                    {renderObjectFields(record.temperatureManagement)}
                  </View>
                )}
              </View>
            )}

            {/* Fluid/Blood Management */}
            {(record.fluidBalance || record.estimatedBloodLoss !== undefined || record.transfusionRequired !== undefined) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Fluid/Blood Management</Text>

                {/* Fluid Balance */}
                {record.fluidBalance && (
                  <View style={styles.groupContainer}>
                    <Text style={styles.groupTitle}>Fluid Balance</Text>
                    {renderObjectFields(record.fluidBalance)}
                  </View>
                )}

                {/* Estimated Blood Loss */}
                {record.estimatedBloodLoss !== undefined && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Estimated Blood Loss</Text>
                    <Text style={styles.fieldValue}>{safeString(record.estimatedBloodLoss)} mL</Text>
                  </View>
                )}

                {/* Transfusion Required */}
                {record.transfusionRequired !== undefined && (
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Transfusion Required</Text>
                    <Text style={styles.fieldValue}>{record.transfusionRequired ? 'Yes' : 'No'}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Vital Signs Log */}
            {record.vitalSignsLog?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} wrap={false}>Vital Signs Log</Text>
                {record.vitalSignsLog.map((vital, vIdx) => {
                  const vitalEntries = [];
                  if (vital.time) vitalEntries.push(`Time: ${formatTime(vital.time)}`);
                  if (vital.heartRate) vitalEntries.push(`HR: ${vital.heartRate}`);
                  if (vital.bloodPressure) vitalEntries.push(`BP: ${vital.bloodPressure}`);
                  if (vital.spO2) vitalEntries.push(`SpO2: ${vital.spO2}`);
                  if (vital.etCO2) vitalEntries.push(`EtCO2: ${vital.etCO2}`);
                  if (vital.temperature) vitalEntries.push(`Temp: ${vital.temperature}`);
                  return (
                    <Text key={vIdx} style={styles.listItem}>
                      {vIdx + 1}. {safeString(vitalEntries.join(' | '))}
                    </Text>
                  );
                })}
              </View>
            )}

            {/* Hemodynamic Support */}
            {record.hemodynamicSupport?.length > 0 && (
              <View style={styles.section} wrap={record.hemodynamicSupport.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Hemodynamic Support</Text>
                {record.hemodynamicSupport.map((support, sIdx) => {
                  if (typeof support === 'object') {
                    const supportText = [support.medication, support.dose, support.indication].filter(Boolean).join(' - ');
                    return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {safeString(supportText)}</Text>;
                  }
                  return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {safeString(support)}</Text>;
                })}
              </View>
            )}

            {/* Medications */}
            {(record.analgesicRegimen?.length > 0 || record.antiemeticAdministered?.length > 0 || record.reversalAgents?.length > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} wrap={false}>Medications</Text>

                {/* Analgesic Regimen */}
                {record.analgesicRegimen?.length > 0 && (
                  <View style={styles.groupContainer}>
                    <Text style={styles.groupTitle}>Analgesic Regimen</Text>
                    {record.analgesicRegimen.map((med, mIdx) => {
                      if (typeof med === 'object') {
                        const medText = [med.medication, med.dose, med.route].filter(Boolean).join(' - ');
                        return <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {safeString(medText)}</Text>;
                      }
                      return <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {safeString(med)}</Text>;
                    })}
                  </View>
                )}

                {/* Antiemetic Administered */}
                {record.antiemeticAdministered?.length > 0 && (
                  <View style={styles.groupContainer}>
                    <Text style={styles.groupTitle}>Antiemetic Administered</Text>
                    {record.antiemeticAdministered.map((med, mIdx) => {
                      if (typeof med === 'object') {
                        const medText = [med.medication, med.dose].filter(Boolean).join(' - ');
                        return <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {safeString(medText)}</Text>;
                      }
                      return <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {safeString(med)}</Text>;
                    })}
                  </View>
                )}

                {/* Reversal Agents */}
                {record.reversalAgents?.length > 0 && (
                  <View style={styles.groupContainer}>
                    <Text style={styles.groupTitle}>Reversal Agents</Text>
                    {record.reversalAgents.map((agent, aIdx) => {
                      if (typeof agent === 'object') {
                        const agentText = [agent.medication, agent.dose, agent.indication].filter(Boolean).join(' - ');
                        return <Text key={aIdx} style={styles.listItem}>{aIdx + 1}. {safeString(agentText)}</Text>;
                      }
                      return <Text key={aIdx} style={styles.listItem}>{aIdx + 1}. {safeString(agent)}</Text>;
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Adverse Events */}
            {record.adverseEvents?.length > 0 && (
              <View style={styles.section} wrap={record.adverseEvents.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Adverse Events</Text>
                {record.adverseEvents.map((event, eIdx) => {
                  if (typeof event === 'object') {
                    const eventText = [event.event, event.time, event.intervention].filter(Boolean).join(' - ');
                    return <Text key={eIdx} style={styles.listItem}>{eIdx + 1}. {safeString(eventText)}</Text>;
                  }
                  return <Text key={eIdx} style={styles.listItem}>{eIdx + 1}. {safeString(event)}</Text>;
                })}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default IntraoperativeMonitoringDocumentPDFTemplate;
