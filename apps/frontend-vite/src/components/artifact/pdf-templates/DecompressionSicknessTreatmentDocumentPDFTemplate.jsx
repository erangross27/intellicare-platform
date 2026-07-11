/**
 * DecompressionSicknessTreatmentDocumentPDFTemplate.jsx
 * Box-free bigger fonts per checklist (26/19/16/12/14) -- LETTER -- new blue theme consistent
 * Collection: decompression_sickness_treatment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4, textTransform: 'uppercase' },
  recordContainer: { marginBottom: 0, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', fontFamily: 'Helvetica' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', paddingBottom: 2 },
  fieldBox: { marginBottom: 6, paddingBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', paddingBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const stripDelims = (t) => String(t || '').replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitByComma = (text) => { if (!text || typeof text !== 'string') return [text || '']; const result = []; let current = ''; let depth = 0; for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '(') { depth++; current += ch; } else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; } else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; } else { current += ch; } } const t = current.trim(); if (t) result.push(t); return result.length > 0 ? result : [text]; };
const fmtBool = (v) => v ? 'Yes' : 'No';

const renderSimpleRowPDF = (label, value, showNumber = true) => {
  if (!hasVal(value)) return null;
  const display = stripDelims(String(value));
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>{showNumber ? '1. ' : ''}{display}</Text>
    </View>
  );
};

const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') return renderSimpleRowPDF(label, text);
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    const clean = stripDelims(parsed.isLabeled ? parsed.value : s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(clean);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: parsed.label });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: stripDelims(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: clean, num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: clean, num: n++ });
    }
  });

  const wrapProp = rows.length > 8 ? true : false;
  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

const DecompressionSicknessTreatmentDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.decompression_sickness_treatment && Array.isArray(data.decompression_sickness_treatment)) {
    records = data.decompression_sickness_treatment;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.decompression_sickness_treatment) {
      records = docData.decompression_sickness_treatment;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Decompression Sickness Treatment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Decompression Sickness Treatment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Decompression Sickness Treatment ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* Treatment Protocol */}
            {['treatmentTableUsed', 'totalHyperbaricOxygenTime', 'maximumTreatmentDepth', 'atmospheresAbsolutePressure', 'numberOfTableExtensions', 'timeToRecompression'].some(f => hasVal(record[f])) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Treatment Protocol</Text>
                  {hasVal(record.treatmentTableUsed) && renderSimpleRowPDF('Treatment Table Used', record.treatmentTableUsed)}
                  {hasVal(record.totalHyperbaricOxygenTime) && renderSimpleRowPDF('Total Hyperbaric Oxygen Time', record.totalHyperbaricOxygenTime)}
                  {hasVal(record.maximumTreatmentDepth) && renderSimpleRowPDF('Maximum Treatment Depth', record.maximumTreatmentDepth)}
                  {hasVal(record.atmospheresAbsolutePressure) && renderSimpleRowPDF('Atmospheres Absolute Pressure', record.atmospheresAbsolutePressure)}
                  {hasVal(record.numberOfTableExtensions) && renderSimpleRowPDF('Number of Table Extensions', record.numberOfTableExtensions)}
                  {hasVal(record.timeToRecompression) && renderSimpleRowPDF('Time to Recompression', record.timeToRecompression)}
                </View>
              </View>
            )}

            {/* DCS Classification */}
            {['dcsType', 'diveProfilePriorToSymptoms', 'symptomOnsetLatency', 'surfaceIntervalHistory', 'altitudeExposureHistory'].some(f => hasVal(record[f])) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>DCS Classification</Text>
                  {hasVal(record.dcsType) && renderSentenceField('DCS Type', record.dcsType)}
                  {hasVal(record.diveProfilePriorToSymptoms) && renderSentenceField('Dive Profile Prior to Symptoms', record.diveProfilePriorToSymptoms)}
                  {hasVal(record.symptomOnsetLatency) && renderSimpleRowPDF('Symptom Onset Latency', record.symptomOnsetLatency)}
                  {hasVal(record.surfaceIntervalHistory) && renderSentenceField('Surface Interval History', record.surfaceIntervalHistory)}
                  {hasVal(record.altitudeExposureHistory) && renderSentenceField('Altitude Exposure History', record.altitudeExposureHistory)}
                </View>
              </View>
            )}

            {/* Clinical Assessment */}
            {['arterialGasEmbolismSuspected', 'patentForamenOvaleScreening', 'neurologicalExamFindings', 'spinalCordInvolvementLevel', 'vestibularSymptomAssessment', 'bubbleGradeKissman'].some(f => hasVal(record[f])) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Clinical Assessment</Text>
                  {hasVal(record.arterialGasEmbolismSuspected) && renderSimpleRowPDF('Arterial Gas Embolism Suspected', fmtBool(record.arterialGasEmbolismSuspected))}
                  {hasVal(record.patentForamenOvaleScreening) && renderSimpleRowPDF('Patent Foramen Ovale Screening', record.patentForamenOvaleScreening)}
                  {hasVal(record.spinalCordInvolvementLevel) && renderSimpleRowPDF('Spinal Cord Involvement Level', record.spinalCordInvolvementLevel)}
                  {hasVal(record.bubbleGradeKissman) && renderSimpleRowPDF('Bubble Grade (Kissman)', record.bubbleGradeKissman)}
                  {hasVal(record.neurologicalExamFindings) && renderSentenceField('Neurological Exam Findings', record.neurologicalExamFindings)}
                  {hasVal(record.vestibularSymptomAssessment) && renderSentenceField('Vestibular Symptom Assessment', record.vestibularSymptomAssessment)}
                </View>
              </View>
            )}

            {/* Treatment Outcomes */}
            {['pretreatmentSymptomSeverityScore', 'posttreatmentSymptomResolution', 'adjunctiveLidocaineAdministered', 'fluidResuscitationVolume', 'hematocritPreTreatment', 'followUpHboTreatments'].some(f => hasVal(record[f])) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Treatment Outcomes</Text>
                  {hasVal(record.pretreatmentSymptomSeverityScore) && renderSimpleRowPDF('Pretreatment Symptom Severity Score', record.pretreatmentSymptomSeverityScore)}
                  {hasVal(record.adjunctiveLidocaineAdministered) && renderSimpleRowPDF('Adjunctive Lidocaine Administered', fmtBool(record.adjunctiveLidocaineAdministered))}
                  {hasVal(record.fluidResuscitationVolume) && renderSimpleRowPDF('Fluid Resuscitation Volume', record.fluidResuscitationVolume)}
                  {hasVal(record.hematocritPreTreatment) && renderSimpleRowPDF('Hematocrit Pre-Treatment', record.hematocritPreTreatment)}
                  {hasVal(record.followUpHboTreatments) && renderSimpleRowPDF('Follow-Up HBO Treatments', record.followUpHboTreatments)}
                  {hasVal(record.posttreatmentSymptomResolution) && renderSentenceField('Posttreatment Symptom Resolution', record.posttreatmentSymptomResolution)}
                </View>
              </View>
            )}

            {/* Return to Diving */}
            {hasVal(record.returnToDivingClearance) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Return to Diving</Text>
                  {renderSentenceField('Return to Diving Clearance', record.returnToDivingClearance)}
                </View>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DecompressionSicknessTreatmentDocumentPDFTemplate;
