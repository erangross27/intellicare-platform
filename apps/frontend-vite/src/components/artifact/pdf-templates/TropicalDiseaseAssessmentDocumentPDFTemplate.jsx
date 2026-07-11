/**
 * TropicalDiseaseAssessmentDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: tropical_disease_assessment
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
// peakTemperature 0 (non-physiological) is a sentinel => hide. parasitemia 0% is meaningful => show.
const isSentinelTemp = (v) => v === 0 || v === null || v === undefined;
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

const TropicalDiseaseAssessmentDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.tropical_disease_assessment && Array.isArray(data.tropical_disease_assessment)) {
    records = data.tropical_disease_assessment;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.tropical_disease_assessment) {
      records = docData.tropical_disease_assessment;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Tropical Disease Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Tropical Disease Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Tropical Disease Assessment ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>

            {/* 1. Travel History */}
            {(hasVal(record.travelHistoryCountries) || hasVal(record.travelStartDate) || hasVal(record.travelReturnDate) || hasVal(record.exposureHistory)) && (
              <View style={styles.section}>
                {Array.isArray(record.travelHistoryCountries) && record.travelHistoryCountries.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.travelHistoryCountries.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Travel History</Text>
                    <Text style={styles.fieldLabel}>Travel History Countries</Text>
                    {record.travelHistoryCountries.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.travelStartDate) && (
                  <View style={styles.fieldBox} wrap={false}>
                    {!(Array.isArray(record.travelHistoryCountries) && record.travelHistoryCountries.length > 0) && <Text style={styles.sectionTitle}>Travel History</Text>}
                    {renderFieldRow('Travel Start Date', formatDate(record.travelStartDate))}
                  </View>
                )}
                {hasVal(record.travelReturnDate) && renderFieldRow('Travel Return Date', formatDate(record.travelReturnDate))}
                {hasVal(record.exposureHistory) && renderSentenceField('Exposure History', record.exposureHistory, !(hasVal(record.travelHistoryCountries) || hasVal(record.travelStartDate)) ? 'Travel History' : null)}
              </View>
            )}

            {/* 2. Vector & Prophylaxis */}
            {(hasVal(record.vectorExposure) || hasVal(record.prophylaxisCompliance) || hasVal(record.vaccinationStatus)) && (
              <View style={styles.section}>
                {Array.isArray(record.vectorExposure) && record.vectorExposure.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.vectorExposure.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Vector & Prophylaxis</Text>
                    <Text style={styles.fieldLabel}>Vector Exposure</Text>
                    {record.vectorExposure.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.prophylaxisCompliance) && renderSentenceField('Prophylaxis Compliance', record.prophylaxisCompliance, !(Array.isArray(record.vectorExposure) && record.vectorExposure.length > 0) ? 'Vector & Prophylaxis' : null)}
                {hasVal(record.vaccinationStatus) && renderSentenceField('Vaccination Status', record.vaccinationStatus)}
              </View>
            )}

            {/* 3. Fever Presentation */}
            {(hasVal(record.feverOnsetDate) || hasVal(record.feverPattern) || !isSentinelTemp(record.peakTemperature) || hasVal(record.suspectedPathogen)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Fever Presentation</Text>
                  {hasVal(record.feverOnsetDate) && renderFieldRow('Fever Onset Date', formatDate(record.feverOnsetDate))}
                  {!isSentinelTemp(record.peakTemperature) && renderFieldRow('Peak Temperature', record.peakTemperature)}
                </View>
                {hasVal(record.feverPattern) && renderSentenceField('Fever Pattern', record.feverPattern)}
                {hasVal(record.suspectedPathogen) && renderSentenceField('Suspected Pathogen', record.suspectedPathogen)}
              </View>
            )}

            {/* 4. Parasitology */}
            {(hasVal(record.parasitologyResults) || hasVal(record.malariaSpecies) || hasVal(record.parasitemia) || hasVal(record.rapidDiagnosticTest)) && (
              <View style={styles.section}>
                {hasVal(record.parasitologyResults) && renderSentenceField('Parasitology Results', record.parasitologyResults, 'Parasitology')}
                {hasVal(record.malariaSpecies) && renderFieldRow('Malaria Species', record.malariaSpecies)}
                {hasVal(record.parasitemia) && renderFieldRow('Parasitemia', record.parasitemia)}
                {hasVal(record.rapidDiagnosticTest) && renderSentenceField('Rapid Diagnostic Test', record.rapidDiagnosticTest, !hasVal(record.parasitologyResults) ? 'Parasitology' : null)}
              </View>
            )}

            {/* 5. Serology */}
            {hasVal(record.serologyResults) && (
              <View style={styles.section}>
                {renderSentenceField('Serology Results', record.serologyResults, 'Serology')}
              </View>
            )}

            {/* 6. Clinical Findings */}
            {(hasVal(record.hepatosplenomegaly) || hasVal(record.rashCharacteristics) || hasVal(record.neurologicSymptoms) || hasVal(record.hemorrhagicManifestations)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Clinical Findings</Text>
                  {hasVal(record.hepatosplenomegaly) && renderFieldRow('Hepatosplenomegaly', record.hepatosplenomegaly ? 'Yes' : 'No')}
                  {hasVal(record.hemorrhagicManifestations) && renderFieldRow('Hemorrhagic Manifestations', record.hemorrhagicManifestations ? 'Yes' : 'No')}
                </View>
                {hasVal(record.rashCharacteristics) && renderSentenceField('Rash Characteristics', record.rashCharacteristics)}
                {Array.isArray(record.neurologicSymptoms) && record.neurologicSymptoms.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.neurologicSymptoms.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Neurologic Symptoms</Text>
                    {record.neurologicSymptoms.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 7. Treatment */}
            {(hasVal(record.antimicrobialTherapy) || hasVal(record.treatmentResponse)) && (
              <View style={styles.section}>
                {hasVal(record.antimicrobialTherapy) && renderSentenceField('Antimicrobial Therapy', record.antimicrobialTherapy, 'Treatment')}
                {hasVal(record.treatmentResponse) && renderSentenceField('Treatment Response', record.treatmentResponse, !hasVal(record.antimicrobialTherapy) ? 'Treatment' : null)}
              </View>
            )}

            {/* 8. Complications */}
            {Array.isArray(record.complicationsDeveloped) && record.complicationsDeveloped.length > 0 && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={record.complicationsDeveloped.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Complications</Text>
                  <Text style={styles.fieldLabel}>Complications Developed</Text>
                  {record.complicationsDeveloped.map((item, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* 9. Public Health */}
            {(hasVal(record.isolationRequired) || hasVal(record.publicHealthNotification)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Public Health</Text>
                {hasVal(record.isolationRequired) && renderFieldRow('Isolation Required', record.isolationRequired ? 'Yes' : 'No')}
                {hasVal(record.publicHealthNotification) && renderFieldRow('Public Health Notification', record.publicHealthNotification ? 'Yes' : 'No')}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TropicalDiseaseAssessmentDocumentPDFTemplate;
