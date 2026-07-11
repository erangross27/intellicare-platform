/**
 * BoneScanReportsDocumentPDFTemplate.jsx
 * Helvetica — A4 — full schema parity — grayscale only
 * Collection: bone_scan_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; return String(v || ''); };

const FL = {
  radiopharmaceuticalAgent: 'Radiopharmaceutical', injectedDose: 'Injected Dose', uptakeDelay: 'Uptake Delay',
  bloodPoolImaging: 'Blood Pool Imaging', skeletalUptakePattern: 'Skeletal Uptake Pattern', superScanPattern: 'Super Scan Pattern',
  metastaticDisease: 'Metastatic Disease', clinicalCorrelation: 'Clinical Correlation', pageticChanges: 'Pagetic Changes',
  osteoporosisEvidence: 'Osteoporosis Evidence', osteosarcomaFindings: 'Osteosarcoma Findings', osteomyelitisEvidence: 'Osteomyelitis Evidence',
  renalClearance: 'Renal Clearance', softtissueUptake: 'Soft Tissue Uptake', spinalAlignment: 'Spinal Alignment',
  followUpRecommendations: 'Follow Up Recommendations',
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* renderField: simple string field (label + value) */
const renderField = (label, value) => {
  if (!hasVal(value)) return null;
  return (<View><Text style={styles.subSectionTitle}>{label}</Text><Text style={styles.fieldValue}>{fmtVal(value)}</Text></View>);
};

/* renderBooleanField: Yes/No */
const renderBooleanField = (label, value) => {
  if (!hasVal(value)) return null;
  return (<View><Text style={styles.subSectionTitle}>{label}</Text><Text style={styles.fieldValue}>{value ? 'Yes' : 'No'}</Text></View>);
};

/* renderSentenceField: per-sentence numbered narrative */
const renderSentenceField = (label, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;
  return (
    <View>
      <Text style={styles.subSectionTitle}>{label}</Text>
      {sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}
    </View>
  );
};

/* renderArrayField: numbered list */
const renderArrayField = (title, items) => {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  if (safe.length === 0) return null;
  return (
    <View style={styles.fieldContainer} wrap={safe.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {safe.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(item)}</Text>)}
    </View>
  );
};

const BoneScanReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.bone_scan_reports) return Array.isArray(r.bone_scan_reports) ? r.bone_scan_reports : [r.bone_scan_reports]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bone_scan_reports) return Array.isArray(dd.bone_scan_reports) ? dd.bone_scan_reports : [dd.bone_scan_reports]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Bone Scan Reports</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Bone Scan Reports</Text>
        {records.map((record, idx) => {
          const hotSpots = Array.isArray(record.hotSpotLocations) ? record.hotSpotLocations.filter(Boolean) : [];
          const coldSpots = Array.isArray(record.coldSpotLocations) ? record.coldSpotLocations.filter(Boolean) : [];
          const fractures = Array.isArray(record.fractureSites) ? record.fractureSites.filter(Boolean) : [];
          const arthritic = Array.isArray(record.arthriticChanges) ? record.arthriticChanges.filter(Boolean) : [];
          const prosthetics = Array.isArray(record.prostheticDevices) ? record.prostheticDevices.filter(Boolean) : [];
          const photonDef = Array.isArray(record.photonDeficiency) ? record.photonDeficiency.filter(Boolean) : [];
          const artifacts = Array.isArray(record.imagingArtifacts) ? record.imagingArtifacts.filter(Boolean) : [];

          // Imaging Parameters: 3 strings + bloodPoolImaging boolean
          const hasImaging = ['radiopharmaceuticalAgent', 'injectedDose', 'uptakeDelay'].some(f => hasVal(record[f])) || hasVal(record.bloodPoolImaging);
          // Skeletal Uptake: skeletalUptakePattern string + superScanPattern boolean
          const hasSkeletal = hasVal(record.skeletalUptakePattern) || hasVal(record.superScanPattern);
          // Clinical Assessment: metastaticDisease + clinicalCorrelation (narratives)
          const hasClinical = hasVal(record.metastaticDisease) || hasVal(record.clinicalCorrelation);
          // Other Findings: pageticChanges, osteoporosisEvidence, osteosarcomaFindings, osteomyelitisEvidence (+ arthriticChanges array)
          const hasOther = ['pageticChanges', 'osteoporosisEvidence', 'osteosarcomaFindings', 'osteomyelitisEvidence'].some(f => hasVal(record[f]));
          // Additional: renalClearance, softtissueUptake, spinalAlignment
          const hasAdditional = ['renalClearance', 'softtissueUptake', 'spinalAlignment'].some(f => hasVal(record[f]));

          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}><Text style={styles.recordTitle}>{`Bone Scan Report ${idx + 1}`}</Text>{(record.date || record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.date || record.createdAt)}</Text>}</View>

              {hasImaging && (
                <View style={styles.fieldContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Imaging Parameters</Text>
                  {renderField(FL.radiopharmaceuticalAgent, record.radiopharmaceuticalAgent)}
                  {renderField(FL.injectedDose, record.injectedDose)}
                  {renderField(FL.uptakeDelay, record.uptakeDelay)}
                  {renderBooleanField(FL.bloodPoolImaging, record.bloodPoolImaging)}
                </View>
              )}

              {hasSkeletal && (
                <View style={styles.fieldContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Skeletal Uptake</Text>
                  {renderField(FL.skeletalUptakePattern, record.skeletalUptakePattern)}
                  {renderBooleanField(FL.superScanPattern, record.superScanPattern)}
                </View>
              )}

              {renderArrayField('Hot Spots', hotSpots)}
              {renderArrayField('Cold Spots', coldSpots)}

              {hasClinical && (
                <View style={styles.fieldContainer} wrap={(splitBySentence(fmtVal(record.metastaticDisease)).length + splitBySentence(fmtVal(record.clinicalCorrelation)).length) > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Clinical Assessment</Text>
                  {renderSentenceField(FL.metastaticDisease, record.metastaticDisease)}
                  {renderSentenceField(FL.clinicalCorrelation, record.clinicalCorrelation)}
                </View>
              )}

              {renderArrayField('Fracture Sites', fractures)}

              {(hasOther || arthritic.length > 0) && (
                <View style={styles.fieldContainer} wrap={(arthritic.length + splitBySentence(fmtVal(record.osteosarcomaFindings)).length + splitBySentence(fmtVal(record.osteomyelitisEvidence)).length) > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Other Findings</Text>
                  {renderField(FL.pageticChanges, record.pageticChanges)}
                  {renderField(FL.osteoporosisEvidence, record.osteoporosisEvidence)}
                  {renderSentenceField(FL.osteosarcomaFindings, record.osteosarcomaFindings)}
                  {renderSentenceField(FL.osteomyelitisEvidence, record.osteomyelitisEvidence)}
                  {arthritic.length > 0 && (<View><Text style={styles.subSectionTitle}>Arthritic Changes</Text>{arthritic.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(item)}</Text>)}</View>)}
                </View>
              )}

              {hasAdditional && (
                <View style={styles.fieldContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Additional</Text>
                  {renderField(FL.renalClearance, record.renalClearance)}
                  {renderField(FL.softtissueUptake, record.softtissueUptake)}
                  {renderField(FL.spinalAlignment, record.spinalAlignment)}
                </View>
              )}

              {(prosthetics.length > 0 || photonDef.length > 0 || artifacts.length > 0) && (
                <View style={styles.fieldContainer} wrap={(prosthetics.length + photonDef.length + artifacts.length) > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Devices & Artifacts</Text>
                  {prosthetics.length > 0 && (<View><Text style={styles.subSectionTitle}>Prosthetic Devices</Text>{prosthetics.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(item)}</Text>)}</View>)}
                  {photonDef.length > 0 && (<View><Text style={styles.subSectionTitle}>Photon Deficiency</Text>{photonDef.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(item)}</Text>)}</View>)}
                  {artifacts.length > 0 && (<View><Text style={styles.subSectionTitle}>Imaging Artifacts</Text>{artifacts.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(item)}</Text>)}</View>)}
                </View>
              )}

              {hasVal(record.followUpRecommendations) && (
                <View style={styles.fieldContainer} wrap={splitBySentence(fmtVal(record.followUpRecommendations)).length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Follow Up</Text>
                  {renderSentenceField(FL.followUpRecommendations, record.followUpRecommendations)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default BoneScanReportsDocumentPDFTemplate;
