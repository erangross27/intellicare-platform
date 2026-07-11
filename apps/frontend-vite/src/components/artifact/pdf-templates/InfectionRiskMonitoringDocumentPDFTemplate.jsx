/**
 * InfectionRiskMonitoringDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: infection_risk_monitoring
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
/* Sentinel zeros: physiologically impossible / "not measured" — hide. Mirrors the UI template. */
const sentinelZero = (v) => v === 0 ? null : v;
const renderNumRow = (label, value, sentinel) => renderFieldRow(label, sentinel ? sentinelZero(value) : value);

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

const InfectionRiskMonitoringDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.infection_risk_monitoring && Array.isArray(data.infection_risk_monitoring)) {
    records = data.infection_risk_monitoring;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.infection_risk_monitoring) {
      records = docData.infection_risk_monitoring;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Infection Risk Monitoring</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Infection Risk Monitoring</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Infection Risk Monitoring ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* 1. Infection Markers — temp/WBC/neutrophil% are sentinel-zero (0 = not measured) */}
            {(hasVal(sentinelZero(record.patientTemperature)) || hasVal(sentinelZero(record.whiteBloodCellCount)) || hasVal(sentinelZero(record.neutrophilPercentage)) || hasVal(record.bandCellCount) || hasVal(record.cReactiveProteinLevel) || hasVal(record.procalcitoninLevel) || hasVal(record.erythrocyteSedimentationRate)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Infection Markers</Text>
                {renderNumRow('Patient Temperature', record.patientTemperature, true)}
                {renderNumRow('White Blood Cell Count', record.whiteBloodCellCount, true)}
                {renderNumRow('Neutrophil Percentage', record.neutrophilPercentage, true)}
                {renderNumRow('Band Cell Count', record.bandCellCount, false)}
                {renderNumRow('C-Reactive Protein Level', record.cReactiveProteinLevel, false)}
                {renderNumRow('Procalcitonin Level', record.procalcitoninLevel, false)}
                {renderNumRow('Erythrocyte Sedimentation Rate', record.erythrocyteSedimentationRate, false)}
              </View>
            )}

            {/* 2. Culture Results */}
            {(hasVal(record.bloodCultureResults) || hasVal(record.urineCultureResults) || hasVal(record.woundCultureResults) || hasVal(record.sputumCultureResults)) && (
              <View style={styles.section}>
                {Array.isArray(record.bloodCultureResults) && record.bloodCultureResults.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.bloodCultureResults.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Culture Results</Text>
                    <Text style={styles.fieldLabel}>Blood Culture Results</Text>
                    {record.bloodCultureResults.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.urineCultureResults) && record.urineCultureResults.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.urineCultureResults.length > 8 ? undefined : false}>
                    {(!Array.isArray(record.bloodCultureResults) || record.bloodCultureResults.length === 0) && <Text style={styles.sectionTitle}>Culture Results</Text>}
                    <Text style={styles.fieldLabel}>Urine Culture Results</Text>
                    {record.urineCultureResults.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.woundCultureResults) && record.woundCultureResults.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.woundCultureResults.length > 8 ? undefined : false}>
                    {(!Array.isArray(record.bloodCultureResults) || record.bloodCultureResults.length === 0) && (!Array.isArray(record.urineCultureResults) || record.urineCultureResults.length === 0) && <Text style={styles.sectionTitle}>Culture Results</Text>}
                    <Text style={styles.fieldLabel}>Wound Culture Results</Text>
                    {record.woundCultureResults.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.sputumCultureResults) && record.sputumCultureResults.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.sputumCultureResults.length > 8 ? undefined : false}>
                    {(!Array.isArray(record.bloodCultureResults) || record.bloodCultureResults.length === 0) && (!Array.isArray(record.urineCultureResults) || record.urineCultureResults.length === 0) && (!Array.isArray(record.woundCultureResults) || record.woundCultureResults.length === 0) && <Text style={styles.sectionTitle}>Culture Results</Text>}
                    <Text style={styles.fieldLabel}>Sputum Culture Results</Text>
                    {record.sputumCultureResults.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 3. Sepsis Scoring & Hemodynamics — SBP/RR/HR/GCS are sentinel-zero (0 = not measured) */}
            {(hasVal(record.sofaScore) || hasVal(record.qsofaScore) || hasVal(sentinelZero(record.systolicBloodPressure)) || hasVal(sentinelZero(record.respiratoryRate)) || hasVal(sentinelZero(record.heartRate)) || hasVal(sentinelZero(record.glasgowComaScale)) || hasVal(record.lactateLevel) || hasVal(record.centralVenousPressure) || hasVal(record.urineOutput)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Sepsis Scoring & Hemodynamics</Text>
                {renderNumRow('SOFA Score', record.sofaScore, false)}
                {renderNumRow('qSOFA Score', record.qsofaScore, false)}
                {renderNumRow('Systolic Blood Pressure', record.systolicBloodPressure, true)}
                {renderNumRow('Respiratory Rate', record.respiratoryRate, true)}
                {renderNumRow('Heart Rate', record.heartRate, true)}
                {renderNumRow('Glasgow Coma Scale', record.glasgowComaScale, true)}
                {renderNumRow('Lactate Level', record.lactateLevel, false)}
                {renderNumRow('Central Venous Pressure', record.centralVenousPressure, false)}
                {renderNumRow('Urine Output', record.urineOutput, false)}
              </View>
            )}

            {/* 4. Infection Control */}
            {(hasVal(record.isolationPrecautionsType) || hasVal(record.antibiticTherapyStatus) || hasVal(record.invasiveDevicesPresent) || hasVal(record.mrssaScreeningResult) || hasVal(record.clostridioidesDeflicileAssay)) && (
              <View style={styles.section}>
                {hasVal(record.isolationPrecautionsType) && renderSentenceField('Isolation Precautions Type', record.isolationPrecautionsType, 'Infection Control')}
                {hasVal(record.antibiticTherapyStatus) && renderSentenceField('Antibiotic Therapy Status', record.antibiticTherapyStatus, !hasVal(record.isolationPrecautionsType) ? 'Infection Control' : null)}
                {Array.isArray(record.invasiveDevicesPresent) && record.invasiveDevicesPresent.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.invasiveDevicesPresent.length > 8 ? undefined : false}>
                    {!hasVal(record.isolationPrecautionsType) && !hasVal(record.antibiticTherapyStatus) && <Text style={styles.sectionTitle}>Infection Control</Text>}
                    <Text style={styles.fieldLabel}>Invasive Devices Present</Text>
                    {record.invasiveDevicesPresent.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.mrssaScreeningResult) && renderSentenceField('MRSA Screening Result', record.mrssaScreeningResult)}
                {hasVal(record.clostridioidesDeflicileAssay) && renderSentenceField('Clostridioides Difficile Assay', record.clostridioidesDeflicileAssay)}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default InfectionRiskMonitoringDocumentPDFTemplate;
