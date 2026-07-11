/**
 * BloodPressureReadingsDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt, numbered items, conditional wrap
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const FIELD_LABELS = { systolicPressure: 'Systolic Pressure', diastolicPressure: 'Diastolic Pressure', heartRate: 'Heart Rate', meanArterialPressure: 'Mean Arterial Pressure', pulseWidth: 'Pulse Width', measurementPosition: 'Measurement Position', cuffSize: 'Cuff Size', measurementArm: 'Measurement Arm', ahaStageClassification: 'AHA Stage Classification', hypertensiveCrisis: 'Hypertensive Crisis', orthostaticMeasurement: 'Orthostatic Measurement', orthostaticSystolic: 'Orthostatic Systolic', orthostaticDiastolic: 'Orthostatic Diastolic', ankleBrachialIndex: 'Ankle Brachial Index', toeBrachialIndex: 'Toe Brachial Index', centralAorticPressure: 'Central Aortic Pressure', augmentationIndex: 'Augmentation Index', pulseWaveVelocity: 'Pulse Wave Velocity', ambulatoryMonitoring: 'Ambulatory Monitoring', homeMonitoring: 'Home Monitoring', whiteCoatEffect: 'White Coat Effect', maskedHypertension: 'Masked Hypertension', cardiovascularRiskScore: 'Cardiovascular Risk Score' };

const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.fieldContainer} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {visible.map((f, i) => (
        <View key={i}>
          <Text style={styles.subSectionTitle}>{FIELD_LABELS[f] || f}</Text>
          <Text style={styles.listItem}>{fmtVal(record[f])}</Text>
        </View>
      ))}
    </View>
  );
};

const BloodPressureReadingsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.blood_pressure_readings) return Array.isArray(r.blood_pressure_readings) ? r.blood_pressure_readings : [r.blood_pressure_readings]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.blood_pressure_readings) return Array.isArray(dd.blood_pressure_readings) ? dd.blood_pressure_readings : [dd.blood_pressure_readings]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Blood Pressure Readings</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Blood Pressure Readings</Text>
        {records.map((record, idx) => {
          const meds = Array.isArray(record.antihypertensiveMedications) ? record.antihypertensiveMedications.filter(Boolean) : [];
          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}>
                <Text style={styles.recordTitle}>{`Blood Pressure Reading ${idx + 1}`}</Text>
                {(record.date || record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.date || record.createdAt)}</Text>}
                {record.ahaStageClassification && <Text style={styles.recordMeta}>{record.ahaStageClassification}</Text>}
              </View>

              {renderFieldGroup('Blood Pressure Reading', ['systolicPressure', 'diastolicPressure', 'heartRate', 'meanArterialPressure', 'pulseWidth'], record)}
              {renderFieldGroup('Measurement Details', ['measurementPosition', 'cuffSize', 'measurementArm'], record)}
              {renderFieldGroup('Classification', ['ahaStageClassification', 'hypertensiveCrisis'], record)}
              {renderFieldGroup('Orthostatic Assessment', ['orthostaticMeasurement', 'orthostaticSystolic', 'orthostaticDiastolic'], record)}
              {renderFieldGroup('Vascular Assessment', ['ankleBrachialIndex', 'toeBrachialIndex', 'centralAorticPressure', 'augmentationIndex', 'pulseWaveVelocity'], record)}
              {renderFieldGroup('Monitoring Status', ['ambulatoryMonitoring', 'homeMonitoring', 'whiteCoatEffect', 'maskedHypertension'], record)}

              {meds.length > 0 && (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Medications</Text>{meds.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</View>)}

              {renderFieldGroup('Risk Assessment', ['cardiovascularRiskScore'], record)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default BloodPressureReadingsDocumentPDFTemplate;
