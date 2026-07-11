/**
 * ResuscitationRecordsPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — resuscitation records
 * Collection: resuscitation_records
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' at ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* ======= COMPONENT ======= */
const ResuscitationRecordsPDFTemplate = ({ document: docProp }) => {
  const records = (() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.resuscitation_records) return Array.isArray(r.resuscitation_records) ? r.resuscitation_records : [r.resuscitation_records];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.resuscitation_records) return Array.isArray(dd.resuscitation_records) ? dd.resuscitation_records : [dd.resuscitation_records]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  })();

  const renderField = (label, value) => {
    if (!hasVal(value)) return null;
    return (
      <View style={styles.fieldBox} wrap={false}>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        <Text style={styles.fieldValue}>{safeString(value)}</Text>
      </View>
    );
  };

  const renderArrayField = (label, items) => {
    const arr = Array.isArray(items) ? items.filter(Boolean) : [];
    if (arr.length === 0) return null;
    return (
      <View style={styles.fieldBox} wrap={arr.length > 8 ? undefined : false}>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        {arr.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    );
  };

  const renderSentenceField = (label, text) => {
    const sentences = splitBySentence(text);
    if (sentences.length === 0) return renderField(label, text);
    return (
      <View style={styles.fieldBox} wrap={sentences.length > 8 ? undefined : false}>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        {sentences.map((s, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
        ))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Resuscitation Records</Text>
        </View>

        {records.length === 0 ? (
          <Text style={styles.noDataText}>No resuscitation records available.</Text>
        ) : (
          records.map((record, index) => (
            <View key={index} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {hasVal(record.date || record.arrestDateTime || record.createdAt) && (
                    <Text style={styles.recordDate}>{formatDate(record.date || record.arrestDateTime || record.createdAt)}</Text>
                  )}
                  {hasVal(record.returnOfSpontaneousCirculation) && (
                    <Text style={styles.recordDate}>{record.returnOfSpontaneousCirculation ? 'ROSC Achieved' : 'No ROSC'}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>Resuscitation Record {index + 1}</Text>
              </View>

              {/* Section 1: Arrest Information */}
              {(hasVal(record.arrestDateTime) || hasVal(record.arrestLocation) || hasVal(record.arrestWitnessed) || hasVal(record.initialRhythm)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Arrest Information</Text>
                  {hasVal(record.arrestDateTime) && renderField('Arrest Date/Time', formatDateTime(record.arrestDateTime))}
                  {renderField('Arrest Location', record.arrestLocation)}
                  {hasVal(record.arrestWitnessed) && renderField('Arrest Witnessed', record.arrestWitnessed ? 'Yes' : 'No')}
                  {renderField('Initial Rhythm', record.initialRhythm)}
                </View>
              )}

              {/* Section 2: CPR & Defibrillation */}
              {(hasVal(record.bystanderCprProvided) || hasVal(record.cprStartTime) || hasVal(record.timeToFirstCompression) || hasVal(record.timeToFirstDefibrillation) || hasVal(record.totalShocksDelivered) || hasVal(record.shockEnergiesDelivered)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>CPR & Defibrillation</Text>
                  {hasVal(record.bystanderCprProvided) && renderField('Bystander CPR Provided', record.bystanderCprProvided ? 'Yes' : 'No')}
                  {hasVal(record.cprStartTime) && renderField('CPR Start Time', formatDateTime(record.cprStartTime))}
                  {hasVal(record.timeToFirstCompression) && renderField('Time to First Compression', `${record.timeToFirstCompression} minutes`)}
                  {hasVal(record.timeToFirstDefibrillation) && renderField('Time to First Defibrillation', `${record.timeToFirstDefibrillation} minutes`)}
                  {hasVal(record.totalShocksDelivered) && renderField('Total Shocks Delivered', record.totalShocksDelivered)}
                  {renderArrayField('Shock Energies Delivered', record.shockEnergiesDelivered)}
                </View>
              )}

              {/* Section 3: Medications Administered */}
              {(hasVal(record.epinephrineDoses) || hasVal(record.amiodaroneDoses)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Medications Administered</Text>
                  {renderArrayField('Epinephrine Doses', record.epinephrineDoses)}
                  {renderArrayField('Amiodarone Doses', record.amiodaroneDoses)}
                </View>
              )}

              {/* Section 4: Airway Management */}
              {(hasVal(record.airwayManagement) || hasVal(record.intubationAttempts) || hasVal(record.etTubeSize) || hasVal(record.etTubeDepth)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Airway Management</Text>
                  {renderField('Airway Management', record.airwayManagement)}
                  {hasVal(record.intubationAttempts) && renderField('Intubation Attempts', record.intubationAttempts)}
                  {renderField('ET Tube Size', record.etTubeSize)}
                  {renderField('ET Tube Depth', record.etTubeDepth)}
                </View>
              )}

              {/* Section 5: Vascular Access */}
              {hasVal(record.vascularAccess) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Vascular Access</Text>
                  {renderArrayField('Access Lines', record.vascularAccess)}
                </View>
              )}

              {/* Section 6: Reversible Causes */}
              {hasVal(record.reversibleCausesAddressed) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Reversible Causes</Text>
                  {renderArrayField('Causes Addressed', record.reversibleCausesAddressed)}
                </View>
              )}

              {/* Section 7: Outcome */}
              {(hasVal(record.returnOfSpontaneousCirculation) || hasVal(record.roscTime) || hasVal(record.totalResuscitationDuration) || hasVal(record.resuscitationOutcome)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Outcome</Text>
                  {hasVal(record.returnOfSpontaneousCirculation) && renderField('Return of Spontaneous Circulation', record.returnOfSpontaneousCirculation ? 'Yes' : 'No')}
                  {hasVal(record.roscTime) && renderField('ROSC Time', formatDateTime(record.roscTime))}
                  {hasVal(record.totalResuscitationDuration) && renderField('Total Resuscitation Duration', `${record.totalResuscitationDuration} minutes`)}
                  {hasVal(record.resuscitationOutcome) && renderSentenceField('Resuscitation Outcome', record.resuscitationOutcome)}
                </View>
              )}

              {/* Section 8: Termination */}
              {hasVal(record.terminationReason) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Termination</Text>
                  {renderSentenceField('Termination Reason', record.terminationReason)}
                </View>
              )}

              {/* Section 9: Post-ROSC Care */}
              {hasVal(record.postRoscCareInitiated) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Post-ROSC Care</Text>
                  {renderArrayField('Care Initiated', record.postRoscCareInitiated)}
                </View>
              )}

              {/* Section 10: Team Leader */}
              {hasVal(record.teamLeaderName) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Team Leader</Text>
                  {renderField('Team Leader Name', record.teamLeaderName)}
                </View>
              )}

              {index < records.length - 1 && <View style={styles.separator} />}
            </View>
          ))
        )}
      </Page>
    </Document>
  );
};

export default ResuscitationRecordsPDFTemplate;
