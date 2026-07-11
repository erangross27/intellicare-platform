/**
 * SedationRecordsDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: sedation_records
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 11, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\bvs)\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (s) => { const m = s.replace(/[;.]+$/, '').trim().match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s); return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: s }; };
const renderFieldRow = (label, value) => { if (!hasVal(value)) return null; return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>); };

const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;
  let totalItems = sentences.length;
  sentences.forEach(s => { const p = parseLabel(s); const rv = p.label ? p.value : s; const ci = rv.split(/,\s+/).filter(x => x.trim()); if (ci.length > 1) totalItems += ci.length - 1; });
  return (<View style={styles.fieldBox} wrap={totalItems > 8 ? undefined : false}>
    {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
    <Text style={styles.fieldLabel}>{label}</Text>
    {sentences.map((s, i) => {
      const p = parseLabel(s);
      const rawVal = p.label ? p.value : s.replace(/[;.]+$/, '').trim();
      const cItems = rawVal.split(/,\s+/).filter(x => x.trim());
      return (<View key={i} style={{ marginBottom: 3, marginLeft: 8 }}>
        {p.label && <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{p.label}</Text>}
        {cItems.length > 1 ? cItems.map((item, ci) => <Text key={ci} style={styles.listItem}>{ci + 1}. {item.trim()}</Text>) : <Text style={styles.listItem}>1. {rawVal}</Text>}
      </View>);
    })}
  </View>);
};

const SedationRecordsDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.sedation_records && Array.isArray(data.sedation_records)) {
    records = data.sedation_records;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.sedation_records) {
      records = docData.sedation_records;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Sedation Records</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Sedation Records</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Sedation Record ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* 1. Provider Information */}
            {(hasVal(record.anesthesiaProviderName) || hasVal(record.monitoringNurseName)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Provider Information</Text>
                {renderFieldRow('Anesthesia Provider Name', record.anesthesiaProviderName)}
                {renderFieldRow('Monitoring Nurse Name', record.monitoringNurseName)}
              </View>
            )}

            {/* 2. Procedure Information */}
            {(hasVal(record.date) || hasVal(record.procedureName) || hasVal(record.sedationLevel) || hasVal(record.asaClassification)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Procedure Information</Text>
                {renderFieldRow('Date', formatDate(record.date))}
                {renderFieldRow('Procedure Name', record.procedureName)}
                {renderFieldRow('Sedation Level', record.sedationLevel)}
                {renderFieldRow('ASA Classification', record.asaClassification)}
              </View>
            )}

            {/* 3. Pre-Sedation Assessment */}
            {(hasVal(record.preoperativeFastingHours) || hasVal(record.baselineVitalSigns) || hasVal(record.consentObtained) || hasVal(record.allergyVerification)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Pre-Sedation Assessment</Text>
                  {hasVal(record.preoperativeFastingHours) && renderFieldRow('Preoperative Fasting Hours', record.preoperativeFastingHours)}
                  {hasVal(record.consentObtained) && renderFieldRow('Consent Obtained', record.consentObtained ? 'Yes' : 'No')}
                  {hasVal(record.allergyVerification) && renderFieldRow('Allergy Verification', record.allergyVerification)}
                </View>
                {hasVal(record.baselineVitalSigns) && typeof record.baselineVitalSigns === 'object' && !Array.isArray(record.baselineVitalSigns) && (
                  <View style={styles.fieldBox} wrap={Object.keys(record.baselineVitalSigns).length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Baseline Vital Signs</Text>
                    {Object.entries(record.baselineVitalSigns).filter(([, v]) => hasVal(v)).map(([k, v], i) => (
                      <Text key={i} style={styles.listItem}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 4. Medications */}
            {(hasVal(record.sedativeMedicationsAdministered) || hasVal(record.reversalAgentsGiven)) && (
              <View style={styles.section}>
                {Array.isArray(record.sedativeMedicationsAdministered) && record.sedativeMedicationsAdministered.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.sedativeMedicationsAdministered.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Medications</Text>
                    <Text style={styles.fieldLabel}>Sedative Medications Administered</Text>
                    {record.sedativeMedicationsAdministered.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.reversalAgentsGiven) && record.reversalAgentsGiven.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.reversalAgentsGiven.length > 8 ? undefined : false}>
                    {!Array.isArray(record.sedativeMedicationsAdministered) || record.sedativeMedicationsAdministered.length === 0 ? <Text style={styles.sectionTitle}>Medications</Text> : null}
                    <Text style={styles.fieldLabel}>Reversal Agents Given</Text>
                    {record.reversalAgentsGiven.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 5. Timing & Monitoring */}
            {(hasVal(record.sedationStartTime) || hasVal(record.sedationEndTime) || hasVal(record.totalProcedureDuration) || hasVal(record.ramsaySedationScore)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Timing & Monitoring</Text>
                  {renderFieldRow('Sedation Start Time', record.sedationStartTime)}
                  {renderFieldRow('Sedation End Time', record.sedationEndTime)}
                  {hasVal(record.totalProcedureDuration) && renderFieldRow('Total Procedure Duration', record.totalProcedureDuration)}
                </View>
                {Array.isArray(record.ramsaySedationScore) && record.ramsaySedationScore.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.ramsaySedationScore.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Ramsay Sedation Score</Text>
                    {record.ramsaySedationScore.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 6. Vitals & Airway */}
            {(hasVal(record.intraoperativeVitals) || hasVal(record.oxygenSupplementation) || hasVal(record.airwayManagement)) && (
              <View style={styles.section}>
                {Array.isArray(record.intraoperativeVitals) && record.intraoperativeVitals.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.intraoperativeVitals.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Vitals & Airway</Text>
                    <Text style={styles.fieldLabel}>Intraoperative Vitals</Text>
                    {record.intraoperativeVitals.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.oxygenSupplementation) && typeof record.oxygenSupplementation === 'object' && !Array.isArray(record.oxygenSupplementation) && (
                  <View style={styles.fieldBox} wrap={Object.keys(record.oxygenSupplementation).length > 8 ? undefined : false}>
                    {(!Array.isArray(record.intraoperativeVitals) || record.intraoperativeVitals.length === 0) && <Text style={styles.sectionTitle}>Vitals & Airway</Text>}
                    <Text style={styles.fieldLabel}>Oxygen Supplementation</Text>
                    {Object.entries(record.oxygenSupplementation).filter(([, v]) => hasVal(v)).map(([k, v], i) => (
                      <Text key={i} style={styles.listItem}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.airwayManagement) && renderSentenceField('Airway Management', record.airwayManagement, (!Array.isArray(record.intraoperativeVitals) || record.intraoperativeVitals.length === 0) && (!record.oxygenSupplementation || typeof record.oxygenSupplementation !== 'object' || Object.keys(record.oxygenSupplementation).length === 0) ? 'Vitals & Airway' : null)}
              </View>
            )}

            {/* 7. Events & Interventions */}
            {(hasVal(record.adverseEvents) || hasVal(record.interventionsRequired)) && (
              <View style={styles.section}>
                {Array.isArray(record.adverseEvents) && record.adverseEvents.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.adverseEvents.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Events & Interventions</Text>
                    <Text style={styles.fieldLabel}>Adverse Events</Text>
                    {record.adverseEvents.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.interventionsRequired) && record.interventionsRequired.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.interventionsRequired.length > 8 ? undefined : false}>
                    {!Array.isArray(record.adverseEvents) || record.adverseEvents.length === 0 ? <Text style={styles.sectionTitle}>Events & Interventions</Text> : null}
                    <Text style={styles.fieldLabel}>Interventions Required</Text>
                    {record.interventionsRequired.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 8. Recovery */}
            {(hasVal(record.dischargeAldreteScore) || hasVal(record.recoveryRoomArrivalTime) || hasVal(record.recoveryRoomDischargeTime) || hasVal(record.postSedationInstructions)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Recovery</Text>
                  {hasVal(record.dischargeAldreteScore) && renderFieldRow('Discharge Aldrete Score', record.dischargeAldreteScore)}
                  {renderFieldRow('Recovery Room Arrival Time', record.recoveryRoomArrivalTime)}
                  {renderFieldRow('Recovery Room Discharge Time', record.recoveryRoomDischargeTime)}
                </View>
                {hasVal(record.postSedationInstructions) && renderSentenceField('Post-Sedation Instructions', record.postSedationInstructions)}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SedationRecordsDocumentPDFTemplate;
