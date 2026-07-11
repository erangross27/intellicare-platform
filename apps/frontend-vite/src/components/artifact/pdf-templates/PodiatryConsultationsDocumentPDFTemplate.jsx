/**
 * PodiatryConsultationsDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: podiatry_consultations
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
  sentences.forEach(s => { const p = parseLabel(s); const rv = p.label ? p.value : s; const ci = (() => { const r2 = []; let c2 = ''; let inQ = false; for (let j = 0; j < rv.length; j++) { const cc = rv[j]; if (cc === '"') { inQ = !inQ; c2 += cc; } else if ((cc === ',' || cc === ';') && !inQ && /\s/.test(rv[j+1] || '')) { const tt = c2.trim(); if (tt) r2.push(tt); c2 = ''; } else { c2 += cc; } } const tt = c2.trim(); if (tt) r2.push(tt); return r2.length > 0 ? r2 : [rv]; })(); if (ci.length > 1) totalItems += ci.length - 1; });
  let counter = 1;
  return (<View style={styles.fieldBox} wrap={totalItems > 8 ? undefined : false}>
    {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
    <Text style={styles.fieldLabel}>{label}</Text>
    {sentences.map((s, i) => {
      const p = parseLabel(s);
      const rawVal = p.label ? p.value : s.replace(/[;.]+$/, '').trim();
      const cItems = (() => { const r2 = []; let c2 = ''; let inQ = false; for (let j = 0; j < rawVal.length; j++) { const cc = rawVal[j]; if (cc === '"') { inQ = !inQ; c2 += cc; } else if ((cc === ',' || cc === ';') && !inQ && /\s/.test(rawVal[j+1] || '')) { const tt = c2.trim(); if (tt) r2.push(tt); c2 = ''; } else { c2 += cc; } } const tt = c2.trim(); if (tt) r2.push(tt); return r2.length > 0 ? r2 : [rawVal]; })();
      return (<View key={i} style={{ marginBottom: 3, marginLeft: 8 }}>
        {p.label && <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{p.label}</Text>}
        {cItems.length > 1 ? cItems.map((item, ci) => <Text key={ci} style={styles.listItem}>{counter++}. {item.trim()}</Text>) : <Text style={styles.listItem}>{counter++}. {rawVal}</Text>}
      </View>);
    })}
  </View>);
};

const PodiatryConsultationsDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.podiatry_consultations && Array.isArray(data.podiatry_consultations)) {
    records = data.podiatry_consultations;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.podiatry_consultations) {
      records = docData.podiatry_consultations;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Podiatry Consultations</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Podiatry Consultations</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Podiatry Consultation ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* 1. Chief Podiatric Complaint */}
            {hasVal(record.chiefPodiatricComplaint) && (
              renderSentenceField('Chief Podiatric Complaint', record.chiefPodiatricComplaint, 'Chief Podiatric Complaint')
            )}

            {/* 2. Vascular Assessment */}
            {(hasVal(record.ankleBrachialIndex) || hasVal(record.toeBrachialIndex) || hasVal(record.pedalPulsesAssessment) || hasVal(record.transcutaneousOxygenPressure)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Vascular Assessment</Text>
                {hasVal(record.ankleBrachialIndex) && renderFieldRow('Ankle-Brachial Index', String(record.ankleBrachialIndex))}
                {hasVal(record.toeBrachialIndex) && renderFieldRow('Toe-Brachial Index', String(record.toeBrachialIndex))}
                {renderSentenceField('Pedal Pulses Assessment', record.pedalPulsesAssessment)}
                {hasVal(record.transcutaneousOxygenPressure) && renderFieldRow('TcPO2 (mmHg)', String(record.transcutaneousOxygenPressure))}
              </View>
            )}

            {/* 3. Classification & Scores */}
            {(hasVal(record.wagnerUlcerClassification) || hasVal(record.universityOfTexasWoundClassification) || hasVal(record.diabeticFootInfectionSeverity) || hasVal(record.charcotArthropathyStage) || hasVal(record.footPostureIndex) || hasVal(record.manchesterOxfordFootQuestionnaire)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Classification and Scores</Text>
                {hasVal(record.wagnerUlcerClassification) && renderFieldRow('Wagner Ulcer Classification', String(record.wagnerUlcerClassification))}
                {renderSentenceField('UT Wound Classification', record.universityOfTexasWoundClassification)}
                {renderSentenceField('Diabetic Foot Infection Severity', record.diabeticFootInfectionSeverity)}
                {renderSentenceField('Charcot Arthropathy Stage', record.charcotArthropathyStage)}
                {hasVal(record.footPostureIndex) && renderFieldRow('Foot Posture Index', String(record.footPostureIndex))}
                {hasVal(record.manchesterOxfordFootQuestionnaire) && renderFieldRow('Manchester-Oxford Foot Questionnaire', String(record.manchesterOxfordFootQuestionnaire))}
              </View>
            )}

            {/* 4. Neuropathy Assessment */}
            {(hasVal(record.semmeswWeinsteinMonofilamentScore) || hasVal(record.vibrationPerceptionThreshold)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Neuropathy Assessment</Text>
                {renderSentenceField('Semmes-Weinstein Monofilament Score', record.semmeswWeinsteinMonofilamentScore)}
                {hasVal(record.vibrationPerceptionThreshold) && renderFieldRow('Vibration Perception Threshold', String(record.vibrationPerceptionThreshold))}
              </View>
            )}

            {/* 5. Biomechanical Assessment */}
            {(hasVal(record.halluxValgusAngle) || hasVal(record.intermetatarsalAngle) || hasVal(record.calcanealPitchAngle) || hasVal(record.talusFirstMetatarsalAngle) || hasVal(record.firstMtpjRangeOfMotion) || hasVal(record.achillesTendonThompsonTest) || hasVal(record.anteriorDrawerTestAnkle)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Biomechanical Assessment</Text>
                {hasVal(record.halluxValgusAngle) && renderFieldRow('Hallux Valgus Angle', String(record.halluxValgusAngle))}
                {hasVal(record.intermetatarsalAngle) && renderFieldRow('Intermetatarsal Angle', String(record.intermetatarsalAngle))}
                {hasVal(record.calcanealPitchAngle) && renderFieldRow('Calcaneal Pitch Angle', String(record.calcanealPitchAngle))}
                {hasVal(record.talusFirstMetatarsalAngle) && renderFieldRow('Talus-First Metatarsal Angle', String(record.talusFirstMetatarsalAngle))}
                {renderSentenceField('First MTPJ Range of Motion', record.firstMtpjRangeOfMotion)}
                {renderSentenceField('Achilles Tendon Thompson Test', record.achillesTendonThompsonTest)}
                {renderSentenceField('Anterior Drawer Test (Ankle)', record.anteriorDrawerTestAnkle)}
              </View>
            )}

            {/* 6. Nail & Toe Deformities */}
            {(hasVal(record.nailDystrophyClassification) || (Array.isArray(record.lesserToeDeformities) && record.lesserToeDeformities.length > 0)) && (
              <View style={styles.section}>
                {hasVal(record.nailDystrophyClassification) && (
                  renderSentenceField('Nail Dystrophy Classification', record.nailDystrophyClassification, 'Nail and Toe Deformities')
                )}
                {Array.isArray(record.lesserToeDeformities) && record.lesserToeDeformities.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.lesserToeDeformities.length > 8 ? undefined : false}>
                    {!hasVal(record.nailDystrophyClassification) && <Text style={styles.sectionTitle}>Nail and Toe Deformities</Text>}
                    <Text style={styles.fieldLabel}>Lesser Toe Deformities</Text>
                    {record.lesserToeDeformities.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 7. Treatment Plan */}
            {(hasVal(record.plantarFasciitisChronicity) || hasVal(record.customOrthoticPrescription) || hasVal(record.offloadingDevicePrescribed)) && (
              <View style={styles.section}>
                {renderSentenceField('Plantar Fasciitis Chronicity', record.plantarFasciitisChronicity, 'Treatment Plan')}
                {renderSentenceField('Custom Orthotic Prescription', record.customOrthoticPrescription, !hasVal(record.plantarFasciitisChronicity) ? 'Treatment Plan' : null)}
                {renderSentenceField('Offloading Device Prescribed', record.offloadingDevicePrescribed, (!hasVal(record.plantarFasciitisChronicity) && !hasVal(record.customOrthoticPrescription)) ? 'Treatment Plan' : null)}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PodiatryConsultationsDocumentPDFTemplate;
