import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

/* ================================================================
   Postoperative Pain Management PDF Template
   Helvetica font, LETTER size, 20pt title / 12pt body
   8 sections: Provider Details, Surgery Information, Pain Assessment,
   Medications, Regional Anesthesia, Monitoring,
   Non-Pharmacological Interventions, Recovery Plan
   ================================================================ */

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    color: '#1a1a2e',
    backgroundColor: '#ffffff',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1a1a2e',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordCard: {
    marginBottom: 16,
    borderTop: '2 solid #606060',
    paddingTop: 10,
  },
  recordHeader: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '1 solid #e2e8f0',
  },
  recordTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
    marginBottom: 3,
  },
  fieldBox: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#f8fafc',
    border: '1 solid #e2e8f0',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#363636',
  },
  subtitleLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#606060',
    marginBottom: 2,
    marginTop: 4,
  },
  fieldValue: {
    fontSize: 12,
    color: '#3f3f3f',
    lineHeight: 1.5,
    marginBottom: 3,
  },
  arrayItem: {
    fontSize: 12,
    color: '#3f3f3f',
    lineHeight: 1.5,
    marginBottom: 3,
    paddingLeft: 8,
  },
  separator: {
    borderBottom: '1 solid #e2e8f0',
    marginVertical: 8,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: '#a1a1a1',
  },
});

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

const safeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return [val].filter(Boolean);
};

const formatDatePDF = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const formatValuePDF = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string' && val.trim() !== '') return val.trim();
  return null;
};

const PostoperativePainManagementDocumentPDFTemplate = ({ document: docProp, records: recordsProp }) => {
  /* Support both { document } and { records } props */
  const records = (() => {
    const raw = recordsProp || docProp;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw?.postoperative_pain_management) return Array.isArray(raw.postoperative_pain_management) ? raw.postoperative_pain_management : [raw.postoperative_pain_management];
    if (raw?.documentData) { const dd = raw.documentData; if (Array.isArray(dd)) return dd; if (dd?.postoperative_pain_management) return Array.isArray(dd.postoperative_pain_management) ? dd.postoperative_pain_management : [dd.postoperative_pain_management]; return [dd]; }
    if (typeof raw === 'object') return [raw];
    return [];
  })();

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Postoperative Pain Management</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Postoperative Pain Management Record {idx + 1}</Text>
            </View>

            {/* Provider Details Section */}
            {(() => {
              const providerFields = [
                record.date ? ['Date', formatDatePDF(record.date)] : null,
                record.surgeryDate ? ['Surgery Date', formatDatePDF(record.surgeryDate)] : null,
              ].filter(Boolean);
              if (providerFields.length === 0) return null;
              return (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Provider Details</Text>
                  {providerFields.map(([label, val], i) => (
                    <View key={i}>
                      <Text style={styles.subtitleLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Surgery Information Section */}
            {(() => {
              const surgeryFields = [
                formatValuePDF(record.surgeryPerformed) !== null ? ['Surgery Performed', safeString(record.surgeryPerformed)] : null,
                formatValuePDF(record.anesthesiaType) !== null ? ['Anesthesia Type', safeString(record.anesthesiaType)] : null,
              ].filter(Boolean);
              if (surgeryFields.length === 0) return null;
              return (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Surgery Information</Text>
                  {surgeryFields.map(([label, val], i) => (
                    <View key={i}>
                      <Text style={styles.subtitleLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Pain Assessment Section */}
            {(() => {
              const painFields = [
                formatValuePDF(record.baselinePainScore) !== null ? ['Baseline Pain Score', formatValuePDF(record.baselinePainScore)] : null,
                formatValuePDF(record.currentPainScore) !== null ? ['Current Pain Score', formatValuePDF(record.currentPainScore)] : null,
                formatValuePDF(record.painScaleUsed) !== null ? ['Pain Scale Used', safeString(record.painScaleUsed)] : null,
                formatValuePDF(record.painCharacteristics) !== null ? ['Pain Characteristics', safeString(record.painCharacteristics)] : null,
              ].filter(Boolean);
              const locations = safeArray(record.painLocation);
              if (painFields.length === 0 && locations.length === 0) return null;
              return (
                <View style={styles.fieldBox} wrap={painFields.length + locations.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Pain Assessment</Text>
                  {painFields.map(([label, val], i) => (
                    <View key={i}>
                      <Text style={styles.subtitleLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                  {locations.length > 0 && (
                    <>
                      <Text style={styles.subtitleLabel}>Pain Location</Text>
                      {locations.map((loc, i) => (
                        <Text key={i} style={styles.arrayItem}>{i + 1}. {safeString(loc)}</Text>
                      ))}
                    </>
                  )}
                </View>
              );
            })()}

            {/* Medications Section */}
            {(() => {
              const opioids = safeArray(record.opioidMedications);
              const nonOpioids = safeArray(record.nonOpioidAnalgesics);
              const protocol = formatValuePDF(record.multimodalAnalgesiaProtocol);
              if (opioids.length === 0 && nonOpioids.length === 0 && protocol === null) return null;
              return (
                <View style={styles.fieldBox} wrap={opioids.length + nonOpioids.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Medications</Text>
                  {opioids.length > 0 && (
                    <>
                      <Text style={styles.subtitleLabel}>Opioid Medications</Text>
                      {opioids.map((med, i) => (
                        <Text key={i} style={styles.arrayItem}>{i + 1}. {safeString(med)}</Text>
                      ))}
                    </>
                  )}
                  {nonOpioids.length > 0 && (
                    <>
                      <Text style={styles.subtitleLabel}>Non-Opioid Analgesics</Text>
                      {nonOpioids.map((med, i) => (
                        <Text key={i} style={styles.arrayItem}>{i + 1}. {safeString(med)}</Text>
                      ))}
                    </>
                  )}
                  {protocol !== null && (
                    <>
                      <Text style={styles.subtitleLabel}>Multimodal Analgesia Protocol</Text>
                      <Text style={styles.fieldValue}>{protocol}</Text>
                    </>
                  )}
                </View>
              );
            })()}

            {/* Regional Anesthesia Section */}
            {(() => {
              const regionalFields = [
                formatValuePDF(record.regionalAnesthesiaTechnique) !== null ? ['Regional Anesthesia Technique', safeString(record.regionalAnesthesiaTechnique)] : null,
                formatValuePDF(record.epiduralCatheterPresent) !== null ? ['Epidural Catheter Present', formatValuePDF(record.epiduralCatheterPresent)] : null,
                formatValuePDF(record.pcaDeviceActive) !== null ? ['PCA Device Active', formatValuePDF(record.pcaDeviceActive)] : null,
                formatValuePDF(record.pcaSettings) !== null ? ['PCA Settings', safeString(record.pcaSettings)] : null,
              ].filter(Boolean);
              if (regionalFields.length === 0) return null;
              return (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Regional Anesthesia</Text>
                  {regionalFields.map(([label, val], i) => (
                    <View key={i}>
                      <Text style={styles.subtitleLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Monitoring Section */}
            {(() => {
              const monFields = [
                formatValuePDF(record.totalOpioidConsumption) !== null ? ['Total Opioid Consumption', formatValuePDF(record.totalOpioidConsumption)] : null,
                formatValuePDF(record.sedationScore) !== null ? ['Sedation Score', formatValuePDF(record.sedationScore)] : null,
                formatValuePDF(record.respiratoryRate) !== null ? ['Respiratory Rate', formatValuePDF(record.respiratoryRate)] : null,
                formatValuePDF(record.oxygenSaturation) !== null ? ['Oxygen Saturation', formatValuePDF(record.oxygenSaturation)] : null,
                formatValuePDF(record.naloxoneAdministered) !== null ? ['Naloxone Administered', formatValuePDF(record.naloxoneAdministered)] : null,
              ].filter(Boolean);
              const effects = safeArray(record.adverseEffects);
              if (monFields.length === 0 && effects.length === 0) return null;
              return (
                <View style={styles.fieldBox} wrap={monFields.length + effects.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Monitoring</Text>
                  {monFields.map(([label, val], i) => (
                    <View key={i}>
                      <Text style={styles.subtitleLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                  {effects.length > 0 && (
                    <>
                      <Text style={styles.subtitleLabel}>Adverse Effects</Text>
                      {effects.map((eff, i) => (
                        <Text key={i} style={styles.arrayItem}>{i + 1}. {safeString(eff)}</Text>
                      ))}
                    </>
                  )}
                </View>
              );
            })()}

            {/* Non-Pharmacological Interventions Section */}
            {(() => {
              const interventions = safeArray(record.nonPharmacologicalInterventions);
              if (interventions.length === 0) return null;
              return (
                <View style={styles.fieldBox} wrap={interventions.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Non-Pharmacological Interventions</Text>
                  {interventions.map((item, i) => (
                    <Text key={i} style={styles.arrayItem}>{i + 1}. {safeString(item)}</Text>
                  ))}
                </View>
              );
            })()}

            {/* Recovery Plan Section */}
            {(() => {
              const recoveryFields = [
                formatValuePDF(record.mobilizationStatus) !== null ? ['Mobilization Status', safeString(record.mobilizationStatus)] : null,
                formatValuePDF(record.painManagementGoal) !== null ? ['Pain Management Goal', safeString(record.painManagementGoal)] : null,
                formatValuePDF(record.transitionPlan) !== null ? ['Transition Plan', safeString(record.transitionPlan)] : null,
              ].filter(Boolean);
              if (recoveryFields.length === 0) return null;
              return (
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Recovery Plan</Text>
                  {recoveryFields.map(([label, val], i) => (
                    <View key={i}>
                      <Text style={styles.subtitleLabel}>{label}</Text>
                      <Text style={styles.fieldValue}>{val}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default PostoperativePainManagementDocumentPDFTemplate;
