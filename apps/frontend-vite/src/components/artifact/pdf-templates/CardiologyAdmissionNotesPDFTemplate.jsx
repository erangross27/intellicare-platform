/**
 * CardiologyAdmissionNotesPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: cardiology_admission_notes
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
  objLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2, marginTop: 3 },
  objValue: { fontSize: 12, lineHeight: 1.5, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const splitByComma = (text) => { if (!text) return []; return String(text).split(/[;,]\s+/).map(s => s.trim()).filter(s => s.length > 0); };
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const KEY_OVERRIDES = { bp: 'BP', hr: 'HR', map: 'MAP', svr: 'SVR', co: 'CO', ci: 'CI', cvp: 'CVP', pcwp: 'PCWP', pap: 'PAP', spo2: 'SpO2', inr: 'INR', ptt: 'PTT', aptt: 'aPTT', doac: 'DOAC' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

const FL = {
  acuteCoronarySyndromeType: 'ACS Type', chiefCardiacComplaint: 'Chief Complaint',
  nyhaClassification: 'NYHA', killipClassification: 'Killip',
  quality: 'Quality', severity: 'Severity', location: 'Location', radiation: 'Radiation', duration: 'Duration', onset: 'Onset',
  troponinLevel: 'Troponin', bnpLevel: 'BNP', leftVentricularEjectionFraction: 'LVEF',
  ejectionFraction: 'Ejection Fraction', wallMotion: 'Wall Motion', valves: 'Valves', complications: 'Complications',
  coronaryArteryDiseaseHistory: 'CAD History', arrhythmiaType: 'Arrhythmia', pulmonaryEdemaPresence: 'Pulmonary Edema',
  thrombolyticEligibility: 'Thrombolytic Eligibility', telemetryMonitoring: 'Telemetry', functionalCapacity: 'Functional Capacity',
};

/* flatten object → [{ label, value, depth }] for grayscale PDF rendering */
const flattenObject = (value, depth = 0, label = '') => {
  const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push({ label, value: fmtVal(value), depth }); return out; }
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    if (isScalar(v)) out.push({ label: humanizeKey(k), value: fmtVal(v), depth });
    else { out.push({ label: humanizeKey(k), value: null, depth }); out.push(...flattenObject(v, depth + 1)); }
  });
  return out;
};

const CardiologyAdmissionNotesPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cardiology_admission_notes) return Array.isArray(r.cardiology_admission_notes) ? r.cardiology_admission_notes : [r.cardiology_admission_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiology_admission_notes) return Array.isArray(dd.cardiology_admission_notes) ? dd.cardiology_admission_notes : [dd.cardiology_admission_notes]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Cardiology Admission Notes</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cardiology Admission Notes</Text>
        {records.map((record, idx) => {
          const cp = record.chestPainCharacteristics || {};
          const echo = record.echocardiogramResults || {};
          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}><Text style={styles.recordTitle}>{`Cardiology Admission ${idx + 1}`}</Text>{record.admissionDate && <Text style={styles.recordMeta}>{formatDate(record.admissionDate)}</Text>}{record.acuteCoronarySyndromeType && <Text style={styles.recordMeta}>{record.acuteCoronarySyndromeType}</Text>}</View>

              {(['acuteCoronarySyndromeType', 'chiefCardiacComplaint', 'nyhaClassification', 'killipClassification'].some(f => hasVal(record[f]))) && (
                <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Admission Information</Text>
                  {['acuteCoronarySyndromeType', 'chiefCardiacComplaint', 'nyhaClassification', 'killipClassification'].filter(f => hasVal(record[f])).map((f, i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[f]}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>)}
                </View>)}

              {hasVal(cp) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Chest Pain Characteristics</Text>
                {Object.entries(cp).filter(([_, v]) => hasVal(v)).map(([k, v], i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[k] || k}</Text><Text style={styles.listItem}>{fmtVal(v)}</Text></View>)}
              </View>)}

              {(['troponinLevel', 'bnpLevel', 'leftVentricularEjectionFraction'].some(f => hasVal(record[f]))) && (
                <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Labs & Vitals</Text>
                  {['troponinLevel', 'bnpLevel', 'leftVentricularEjectionFraction'].filter(f => hasVal(record[f])).map((f, i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[f]}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>)}
                </View>)}

              {hasVal(record.ekgFindings) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>EKG Findings</Text>{splitByComma(record.ekgFindings).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>)}

              {hasVal(echo) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Echocardiogram</Text>
                {Object.entries(echo).filter(([_, v]) => hasVal(v)).map(([k, v], i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[k] || k}</Text><Text style={styles.listItem}>{fmtVal(v)}</Text></View>)}
              </View>)}

              {safeArr(record.cardiacRiskFactors).length > 0 && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Cardiac Risk Factors</Text>{safeArr(record.cardiacRiskFactors).map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}</View>)}
              {safeArr(record.currentCardiacMedications).length > 0 && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Current Cardiac Medications</Text>{safeArr(record.currentCardiacMedications).map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}</View>)}

              {hasVal(record.cardiacCatheterizationPlanned) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Cardiac Catheterization</Text>{splitByComma(record.cardiacCatheterizationPlanned).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>)}

              {safeArr(record.valvularAbnormalities).length > 0 && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Valvular Abnormalities</Text>{safeArr(record.valvularAbnormalities).map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}</View>)}

              {(() => { const hp = record.hemodynamicParameters; if (isEmptyDeep(hp) || isScalar(hp)) return null; const rows = flattenObject(hp); if (rows.length === 0) return null; return (<View style={styles.fieldContainer} wrap={rows.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Hemodynamic Parameters</Text>{rows.map((r, i) => (r.value === null ? <Text key={i} style={[styles.objLabel, { paddingLeft: 4 + r.depth * 10 }]}>{r.label}</Text> : <View key={i}><Text style={[styles.objLabel, { paddingLeft: 4 + r.depth * 10 }]}>{r.label}</Text><Text style={[styles.objValue, { paddingLeft: 12 + r.depth * 10 }]}>{r.value}</Text></View>))}</View>); })()}

              {safeArr(record.inotropicSupport).length > 0 && (() => { const items = safeArr(record.inotropicSupport); return (<View style={styles.fieldContainer} wrap={items.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Inotropic Support</Text>{items.map((it, i) => (isScalar(it) ? <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(it)}</Text> : flattenObject(it).map((r, j) => (r.value === null ? <Text key={`${i}-${j}`} style={[styles.objLabel, { paddingLeft: 4 + r.depth * 10 }]}>{r.label}</Text> : <View key={`${i}-${j}`}><Text style={[styles.objLabel, { paddingLeft: 4 + r.depth * 10 }]}>{r.label}</Text><Text style={[styles.objValue, { paddingLeft: 12 + r.depth * 10 }]}>{r.value}</Text></View>))))}</View>); })()}

              {(() => { const ac = record.anticoagulationStatus; if (isEmptyDeep(ac) || isScalar(ac)) return null; const rows = flattenObject(ac); if (rows.length === 0) return null; return (<View style={styles.fieldContainer} wrap={rows.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>Anticoagulation Status</Text>{rows.map((r, i) => (r.value === null ? <Text key={i} style={[styles.objLabel, { paddingLeft: 4 + r.depth * 10 }]}>{r.label}</Text> : <View key={i}><Text style={[styles.objLabel, { paddingLeft: 4 + r.depth * 10 }]}>{r.label}</Text><Text style={[styles.objValue, { paddingLeft: 12 + r.depth * 10 }]}>{r.value}</Text></View>))}</View>); })()}

              {safeArr(record.cardiacBiomarkerTrend).length > 0 && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Biomarker Trend</Text>{safeArr(record.cardiacBiomarkerTrend).map((t, i) => <Text key={i} style={styles.listItem}>{i + 1}. {t}</Text>)}</View>)}

              {(['coronaryArteryDiseaseHistory', 'arrhythmiaType', 'pulmonaryEdemaPresence', 'thrombolyticEligibility', 'telemetryMonitoring', 'functionalCapacity'].some(f => hasVal(record[f]))) && (
                <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Additional Information</Text>
                  {['coronaryArteryDiseaseHistory', 'arrhythmiaType', 'pulmonaryEdemaPresence', 'thrombolyticEligibility', 'telemetryMonitoring', 'functionalCapacity'].filter(f => hasVal(record[f])).map((f, i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[f]}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>)}
                </View>)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CardiologyAdmissionNotesPDFTemplate;
