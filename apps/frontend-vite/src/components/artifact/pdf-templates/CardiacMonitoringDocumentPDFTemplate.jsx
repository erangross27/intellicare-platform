/**
 * CardiacMonitoringDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: cardiac_monitoring
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const NUMBER_FIELDS = new Set([
  'heartRate', 'systolicBloodPressure', 'diastolicBloodPressure', 'meanArterialPressure',
  'centralVenousPressure', 'pulmonaryWedgePressure', 'cardiacOutput', 'cardiacIndex',
  'strokeVolume', 'ejectionFraction', 'qtInterval', 'qtcInterval', 'prInterval', 'qrsWidth',
  'svr', 'pvr', 'pacingRate',
]);
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const hasNumVal = (v) => { if (v === null || v === undefined || v === '') return false; const n = parseFloat(v); if (isNaN(n)) return typeof v === 'string' ? v.trim() !== '' : false; return n !== 0; };
const fieldHasVal = (f, v) => NUMBER_FIELDS.has(f) ? hasNumVal(v) : hasVal(v);
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const humanizeKey = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
const fmtArrayItem = (it) => {
  if (it === null || it === undefined) return '';
  if (typeof it === 'object' && !Array.isArray(it)) return Object.entries(it).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${humanizeKey(k)}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(', ');
  if (Array.isArray(it)) return it.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  if (typeof it === 'boolean') return it ? 'Yes' : 'No';
  return String(it);
};
const arrItems = (v) => Array.isArray(v) ? v.filter(x => hasVal(x)) : (hasVal(v) ? [v] : []);
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

const FL = {
  rhythmType: 'Rhythm Type', heartRate: 'Heart Rate', nyhaClass: 'NYHA Class',
  systolicBloodPressure: 'Systolic BP', diastolicBloodPressure: 'Diastolic BP', meanArterialPressure: 'Mean Arterial Pressure',
  centralVenousPressure: 'CVP', pulmonaryArterPressure: 'Pulmonary Artery Pressure', pulmonaryWedgePressure: 'PCWP',
  cardiacOutput: 'Cardiac Output', cardiacIndex: 'Cardiac Index', strokeVolume: 'Stroke Volume',
  ejectionFraction: 'Ejection Fraction', svr: 'SVR', pvr: 'PVR',
  stSegmentChanges: 'ST Segment Changes', qtInterval: 'QT Interval', qtcInterval: 'QTc Interval',
  prInterval: 'PR Interval', qrsWidth: 'QRS Width', pacingMode: 'Pacing Mode', pacingRate: 'Pacing Rate',
};

const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => fieldHasVal(f, record[f]));
  if (visible.length === 0) return null;
  return (<View style={styles.fieldContainer} wrap={visible.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>{title}</Text>{visible.map((f, i) => (<View key={i}><Text style={styles.subSectionTitle}>{FL[f] || f}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>))}</View>);
};

const FL_EVENTS = { arrhythmiaEvents: 'Arrhythmia Events', icdTherapies: 'ICD Therapies', telemetryAlarms: 'Telemetry Alarms' };
const renderEventsGroup = (record) => {
  const fields = ['arrhythmiaEvents', 'icdTherapies', 'telemetryAlarms'].filter(f => arrItems(record[f]).length > 0);
  if (fields.length === 0) return null;
  const total = fields.reduce((n, f) => n + arrItems(record[f]).length, 0);
  return (<View style={styles.fieldContainer} wrap={total > 8 ? undefined : false}><Text style={styles.sectionTitle}>Events & Alarms</Text>{fields.map((f, fi) => { const items = arrItems(record[f]); return (<View key={fi}><Text style={styles.subSectionTitle}>{FL_EVENTS[f]}</Text>{items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {fmtArrayItem(it)}</Text>)}</View>); })}</View>);
};

const CardiacMonitoringDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cardiac_monitoring) return Array.isArray(r.cardiac_monitoring) ? r.cardiac_monitoring : [r.cardiac_monitoring];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiac_monitoring) return Array.isArray(dd.cardiac_monitoring) ? dd.cardiac_monitoring : [dd.cardiac_monitoring]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Cardiac Monitoring</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cardiac Monitoring</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Cardiac Monitoring ${idx + 1}`}</Text>{record.rhythmType && <Text style={{ fontSize: 11, color: '#333', paddingLeft: 4, marginBottom: 2 }}>{record.rhythmType}</Text>}</View>
            {renderFieldGroup('Rhythm & Rate', ['rhythmType', 'heartRate', 'nyhaClass'], record)}
            {renderFieldGroup('Blood Pressure', ['systolicBloodPressure', 'diastolicBloodPressure', 'meanArterialPressure'], record)}
            {renderFieldGroup('Hemodynamics', ['centralVenousPressure', 'pulmonaryArterPressure', 'pulmonaryWedgePressure', 'cardiacOutput', 'cardiacIndex', 'strokeVolume', 'ejectionFraction', 'svr', 'pvr'], record)}
            {(() => {
              const hasST = hasVal(record.stSegmentChanges);
              const stSent = hasST ? splitBySentence(fmtVal(record.stSegmentChanges)) : [];
              const ecgNums = ['qtInterval', 'qtcInterval', 'prInterval', 'qrsWidth'].filter(f => hasNumVal(record[f]));
              if (!hasST && ecgNums.length === 0) return null;
              const total = stSent.length + ecgNums.length;
              return (
                <View style={styles.fieldContainer} wrap={total > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>ECG Parameters</Text>
                  {hasST && <><Text style={styles.subSectionTitle}>ST Segment Changes</Text>{stSent.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</>}
                  {ecgNums.map((f, i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[f]}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>)}
                </View>
              );
            })()}
            {renderFieldGroup('Pacing', ['pacingMode', 'pacingRate'], record)}
            {renderEventsGroup(record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CardiacMonitoringDocumentPDFTemplate;
