/**
 * BurnRehabilitationDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: burn_rehabilitation
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

const BurnRehabilitationDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.burn_rehabilitation && Array.isArray(data.burn_rehabilitation)) {
    records = data.burn_rehabilitation;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.burn_rehabilitation) {
      records = docData.burn_rehabilitation;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Burn Rehabilitation</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Burn Rehabilitation</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Burn Rehabilitation ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* 1. Burn Severity */}
            {(hasVal(record.burnRehabilitationId) || hasVal(record.totalBodySurfaceAreaBurned) || hasVal(record.abbreviatedBurnSeverityIndex) || hasVal(record.bauxScore)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Burn Severity</Text>
                {renderFieldRow('Burn Rehabilitation ID', record.burnRehabilitationId)}
                {renderFieldRow('Total Body Surface Area Burned', record.totalBodySurfaceAreaBurned)}
                {renderFieldRow('Abbreviated Burn Severity Index', record.abbreviatedBurnSeverityIndex)}
                {renderFieldRow('Baux Score', record.bauxScore)}
              </View>
            )}
            {Array.isArray(record.burnDepthClassification) && record.burnDepthClassification.length > 0 && (
              <View style={styles.fieldBox} wrap={record.burnDepthClassification.length > 8 ? undefined : false}>
                <Text style={styles.fieldLabel}>Burn Depth Classification</Text>
                {record.burnDepthClassification.map((item, i) => (
                  <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                ))}
              </View>
            )}

            {/* 2. Wound Management */}
            {(hasVal(record.vancouverScarScaleScore) || hasVal(record.patientAndObserverScarAssessmentScale) || (Array.isArray(record.grafttedSiteLocations) && record.grafttedSiteLocations.length > 0) || (Array.isArray(record.siliconeGelSheetingApplication) && record.siliconeGelSheetingApplication.length > 0) || (Array.isArray(record.hypertrophicScarRiskFactors) && record.hypertrophicScarRiskFactors.length > 0)) && (
              <View style={styles.section}>
                {Array.isArray(record.grafttedSiteLocations) && record.grafttedSiteLocations.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.grafttedSiteLocations.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Wound Management</Text>
                    <Text style={styles.fieldLabel}>Grafted Site Locations</Text>
                    {record.grafttedSiteLocations.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                <View style={styles.fieldBox} wrap={false}>
                  {(!Array.isArray(record.grafttedSiteLocations) || record.grafttedSiteLocations.length === 0) && <Text style={styles.sectionTitle}>Wound Management</Text>}
                  {renderFieldRow('Vancouver Scar Scale Score', record.vancouverScarScaleScore)}
                  {renderFieldRow('Patient and Observer Scar Assessment Scale', record.patientAndObserverScarAssessmentScale)}
                </View>
                {Array.isArray(record.siliconeGelSheetingApplication) && record.siliconeGelSheetingApplication.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.siliconeGelSheetingApplication.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Silicone Gel Sheeting Application</Text>
                    {record.siliconeGelSheetingApplication.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.hypertrophicScarRiskFactors) && record.hypertrophicScarRiskFactors.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.hypertrophicScarRiskFactors.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Hypertrophic Scar Risk Factors</Text>
                    {record.hypertrophicScarRiskFactors.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 3. Rehabilitation */}
            {((Array.isArray(record.rangeOfMotionDeficits) && record.rangeOfMotionDeficits.length > 0) || (Array.isArray(record.contractureLocationAndSeverity) && record.contractureLocationAndSeverity.length > 0) || hasVal(record.pressureGarmentCompliance) || (Array.isArray(record.customOrthosisType) && record.customOrthosisType.length > 0) || (Array.isArray(record.heterotopicOssificationSites) && record.heterotopicOssificationSites.length > 0)) && (
              <View style={styles.section}>
                {Array.isArray(record.rangeOfMotionDeficits) && record.rangeOfMotionDeficits.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.rangeOfMotionDeficits.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Rehabilitation</Text>
                    <Text style={styles.fieldLabel}>Range of Motion Deficits</Text>
                    {record.rangeOfMotionDeficits.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.contractureLocationAndSeverity) && record.contractureLocationAndSeverity.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.contractureLocationAndSeverity.length > 8 ? undefined : false}>
                    {(!Array.isArray(record.rangeOfMotionDeficits) || record.rangeOfMotionDeficits.length === 0) && <Text style={styles.sectionTitle}>Rehabilitation</Text>}
                    <Text style={styles.fieldLabel}>Contracture Location and Severity</Text>
                    {record.contractureLocationAndSeverity.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.pressureGarmentCompliance) && (
                  <View style={styles.fieldBox} wrap={false}>
                    {(!Array.isArray(record.rangeOfMotionDeficits) || record.rangeOfMotionDeficits.length === 0) && (!Array.isArray(record.contractureLocationAndSeverity) || record.contractureLocationAndSeverity.length === 0) && <Text style={styles.sectionTitle}>Rehabilitation</Text>}
                    {renderFieldRow('Pressure Garment Compliance', record.pressureGarmentCompliance)}
                  </View>
                )}
                {Array.isArray(record.customOrthosisType) && record.customOrthosisType.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.customOrthosisType.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Custom Orthosis Type</Text>
                    {record.customOrthosisType.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.heterotopicOssificationSites) && record.heterotopicOssificationSites.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.heterotopicOssificationSites.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Heterotopic Ossification Sites</Text>
                    {record.heterotopicOssificationSites.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 4. Pain Assessment */}
            {(hasVal(record.neuropathicPainScore) || hasVal(record.pruritusIntensityScore) || hasVal(record.thermalSensitivityAssessment)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Pain Assessment</Text>
                  {renderFieldRow('Neuropathic Pain Score', record.neuropathicPainScore)}
                  {renderFieldRow('Pruritus Intensity Score', record.pruritusIntensityScore)}
                </View>
                {hasVal(record.thermalSensitivityAssessment) && renderSentenceField('Thermal Sensitivity Assessment', record.thermalSensitivityAssessment)}
              </View>
            )}

            {/* 5. Functional Outcomes */}
            {(hasVal(record.burnSpecificHealthScaleBrief) || hasVal(record.functionalIndependenceMeasureScore) || hasVal(record.jamarGripStrengthKg) || hasVal(record.sixMinuteWalkTestDistance) || hasVal(record.microstomiaApertureSize) || hasVal(record.communityReintegrationScore)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Functional Outcomes</Text>
                {renderFieldRow('Burn Specific Health Scale Brief', record.burnSpecificHealthScaleBrief)}
                {renderFieldRow('Functional Independence Measure Score', record.functionalIndependenceMeasureScore)}
                {renderFieldRow('Jamar Grip Strength (kg)', record.jamarGripStrengthKg)}
                {renderFieldRow('Six Minute Walk Test Distance', record.sixMinuteWalkTestDistance)}
                {renderFieldRow('Microstomia Aperture Size', record.microstomiaApertureSize)}
                {renderFieldRow('Community Reintegration Score', record.communityReintegrationScore)}
              </View>
            )}

            {/* 6. Surgical History */}
            {Array.isArray(record.reconstructiveSurgeryHistory) && record.reconstructiveSurgeryHistory.length > 0 && (
              <View style={styles.fieldBox} wrap={record.reconstructiveSurgeryHistory.length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Surgical History</Text>
                <Text style={styles.fieldLabel}>Reconstructive Surgery History</Text>
                {record.reconstructiveSurgeryHistory.map((item, i) => (
                  <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BurnRehabilitationDocumentPDFTemplate;
