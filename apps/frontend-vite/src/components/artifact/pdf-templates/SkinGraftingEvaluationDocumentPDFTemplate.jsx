/**
 * SkinGraftingEvaluationDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: skin_grafting_evaluation
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

const SkinGraftingEvaluationDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.skin_grafting_evaluation && Array.isArray(data.skin_grafting_evaluation)) {
    records = data.skin_grafting_evaluation;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.skin_grafting_evaluation) {
      records = docData.skin_grafting_evaluation;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Skin Grafting Evaluation</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Skin Grafting Evaluation</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Skin Grafting Evaluation ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* 1. Graft Specifications */}
            {(hasVal(record.graftDonorSiteLocation) || hasVal(record.graftThicknessType) || hasVal(record.splitThicknessGraftDepth) || hasVal(record.graftExpansionRatio)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Graft Specifications</Text>
                  {renderFieldRow('Graft Donor Site Location', record.graftDonorSiteLocation)}
                  {renderFieldRow('Graft Thickness Type', record.graftThicknessType)}
                  {renderFieldRow('Split Thickness Graft Depth', record.splitThicknessGraftDepth)}
                  {renderFieldRow('Graft Expansion Ratio', record.graftExpansionRatio)}
                </View>
              </View>
            )}

            {/* 2. Recipient Bed Assessment */}
            {(hasVal(record.recipientBedVascularityScore) || hasVal(record.woundBedPreparationMethod) || hasVal(record.woundBedBacterialBioburden) || hasVal(record.recipientSiteArea)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Recipient Bed Assessment</Text>
                  {renderFieldRow('Recipient Bed Vascularity Score', record.recipientBedVascularityScore)}
                  {renderFieldRow('Recipient Site Area', record.recipientSiteArea)}
                </View>
                {hasVal(record.woundBedPreparationMethod) && renderSentenceField('Wound Bed Preparation Method', record.woundBedPreparationMethod)}
                {hasVal(record.woundBedBacterialBioburden) && renderSentenceField('Wound Bed Bacterial Bioburden', record.woundBedBacterialBioburden)}
              </View>
            )}

            {/* 3. Graft Outcomes */}
            {(hasVal(record.graftTakePercentage) || hasVal(record.graftFixationTechnique) || hasVal(record.plasmaticImbibitionStatus) || hasVal(record.inosculationOnsetDay)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Graft Outcomes</Text>
                {renderFieldRow('Graft Take Percentage', record.graftTakePercentage)}
                {renderFieldRow('Graft Fixation Technique', record.graftFixationTechnique)}
                {renderFieldRow('Plasmatic Imbibition Status', typeof record.plasmaticImbibitionStatus === 'boolean' ? (record.plasmaticImbibitionStatus ? 'Yes' : 'No') : record.plasmaticImbibitionStatus)}
                {renderFieldRow('Inosculation Onset Day', record.inosculationOnsetDay)}
              </View>
            )}

            {/* 4. Donor Site */}
            {(hasVal(record.donorSiteHealingDays) || hasVal(record.seromaPrevention) || hasVal(record.totalBurnSurfaceArea)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Donor Site</Text>
                {renderFieldRow('Donor Site Healing Days', record.donorSiteHealingDays)}
                {renderFieldRow('Seroma Prevention', typeof record.seromaPrevention === 'boolean' ? (record.seromaPrevention ? 'Yes' : 'No') : record.seromaPrevention)}
                {renderFieldRow('Total Burn Surface Area', record.totalBurnSurfaceArea)}
              </View>
            )}

            {/* 5. Graft Complications */}
            {(hasVal(record.graftFailureMechanism) || hasVal(record.graftContracturePercentage) || hasVal(record.dermalSubstitutePriorUse)) && (
              <View style={styles.section}>
                {Array.isArray(record.graftFailureMechanism) && record.graftFailureMechanism.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.graftFailureMechanism.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Graft Complications</Text>
                    <Text style={styles.fieldLabel}>Graft Failure Mechanism</Text>
                    {record.graftFailureMechanism.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {renderFieldRow('Graft Contracture Percentage', record.graftContracturePercentage)}
                {hasVal(record.dermalSubstitutePriorUse) && renderSentenceField('Dermal Substitute Prior Use', record.dermalSubstitutePriorUse, (!Array.isArray(record.graftFailureMechanism) || record.graftFailureMechanism.length === 0) ? 'Graft Complications' : null)}
              </View>
            )}

            {/* 6. Perfusion & Labs */}
            {(hasVal(record.recipientSiteTranscutaneousOxygenTension) || hasVal(record.laserDopplerPerfusionIndex) || hasVal(record.preoperativeAlbuminLevel) || hasVal(record.hemoglobinA1cLevel)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Perfusion & Labs</Text>
                {renderFieldRow('Recipient Site Transcutaneous Oxygen Tension', record.recipientSiteTranscutaneousOxygenTension)}
                {renderFieldRow('Laser Doppler Perfusion Index', record.laserDopplerPerfusionIndex)}
                {renderFieldRow('Preoperative Albumin Level', record.preoperativeAlbuminLevel)}
                {renderFieldRow('Hemoglobin A1c Level', record.hemoglobinA1cLevel)}
              </View>
            )}

            {/* 7. Scar & Therapy */}
            {(hasVal(record.vancouverScarScaleScore) || hasVal(record.cutometerElasticityMeasurement) || hasVal(record.negativePresureWoundTherapySettings)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Scar & Therapy</Text>
                  {renderFieldRow('Vancouver Scar Scale Score', record.vancouverScarScaleScore)}
                  {renderFieldRow('Cutometer Elasticity Measurement', record.cutometerElasticityMeasurement)}
                </View>
                {hasVal(record.negativePresureWoundTherapySettings) && renderSentenceField('Negative Pressure Wound Therapy Settings', record.negativePresureWoundTherapySettings)}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SkinGraftingEvaluationDocumentPDFTemplate;
