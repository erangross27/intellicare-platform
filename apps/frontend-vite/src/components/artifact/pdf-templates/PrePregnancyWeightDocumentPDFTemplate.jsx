/**
 * PrePregnancyWeightDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: pre_pregnancy_weight
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
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
/* numShown: numeric fields (weight/BMI/height/A1c/weight-gain) have no meaningful zero — 0 is a
   sentinel/missing marker, so hide it. Mirrors numberShows in the on-screen template. */
const numShown = (v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); return !Number.isNaN(n) && n !== 0; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; const result = []; let current = ''; let inQuote = false; for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '"' || ch === '\u201C' || ch === '\u201D') { const wasInQuote = inQuote; inQuote = !inQuote; current += ch; if (wasInQuote && !inQuote && current.length >= 2 && current[current.length - 2] === '.' && i + 1 < text.length && /\s/.test(text[i + 1])) { const t2 = current.trim(); if (t2 && !/^[;.,!?]+$/.test(t2)) result.push(t2); current = ''; } continue; } if (ch === '.' && !inQuote && i + 1 < text.length && /\s/.test(text[i + 1])) { const before = current.trim().split(/\s+/).pop() || ''; if (/^(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i.test(before)) { current += ch; continue; } const t = current.trim(); if (t && !/^[;.,!?]+$/.test(t)) result.push(t); current = ''; } else { current += ch; } } const t = current.trim(); if (t && !/^[;.,!?]+$/.test(t)) result.push(t); return result; };
const parseLabel = (s) => { const m = s.replace(/[;.]+$/, '').trim().match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s); return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: s }; };
const renderFieldRow = (label, value) => { if (!hasVal(value)) return null; return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>); };

const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;
  let totalItems = sentences.length;
  sentences.forEach(s => { const p = parseLabel(s); const rv = p.label ? p.value : s; const ci = rv.split(/[,;]\s+/).filter(x => x.trim()); if (ci.length > 1) totalItems += ci.length - 1; });
  let counter = 1;
  return (<View style={styles.fieldBox} wrap={totalItems > 8 ? undefined : false}>
    {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
    <Text style={styles.fieldLabel}>{label}</Text>
    {sentences.map((s, i) => {
      const p = parseLabel(s);
      const rawVal = p.label ? p.value : s.replace(/[;.]+$/, '').trim();
      // Quote-aware comma/semicolon split
      const cItems = (() => { const r2 = []; let c2 = ''; let q2 = false; for (let j = 0; j < rawVal.length; j++) { const cc = rawVal[j]; if (cc === '"') { q2 = !q2; c2 += cc; } else if ((cc === ',' || cc === ';') && !q2 && /\s/.test(rawVal[j+1] || '')) { const tt = c2.trim(); if (tt) r2.push(tt); c2 = ''; } else { c2 += cc; } } const tt = c2.trim(); if (tt) r2.push(tt); return r2.length > 0 ? r2 : [rawVal]; })();
      return (<View key={i} style={{ marginBottom: 3, marginLeft: 8 }}>
        {p.label && <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{p.label}</Text>}
        {cItems.length > 1 ? cItems.map((item, ci) => <Text key={ci} style={styles.listItem}>{counter++}. {item.trim()}</Text>) : <Text style={styles.listItem}>{counter++}. {rawVal}</Text>}
      </View>);
    })}
  </View>);
};

const PrePregnancyWeightDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.pre_pregnancy_weight && Array.isArray(data.pre_pregnancy_weight)) {
    records = data.pre_pregnancy_weight;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.pre_pregnancy_weight) {
      records = docData.pre_pregnancy_weight;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Pre-Pregnancy Weight</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Pre-Pregnancy Weight</Text></View>
        {records.map((record, idx) => {
          let counter = 1;
          return (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Pre-Pregnancy Weight ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* 1. Measurements */}
            {(numShown(record.prePregnancyWeight) || numShown(record.prePregnancyBmi) || hasVal(record.bmiCategory) || numShown(record.heightMeasurement) || hasVal(record.weightMeasurementMethod) || hasVal(record.obesityClass)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Measurements</Text>
                {numShown(record.prePregnancyWeight) && renderFieldRow('Pre-Pregnancy Weight', String(record.prePregnancyWeight))}
                {numShown(record.prePregnancyBmi) && renderFieldRow('Pre-Pregnancy BMI', String(record.prePregnancyBmi))}
                {renderSentenceField('BMI Category', record.bmiCategory)}
                {numShown(record.heightMeasurement) && renderFieldRow('Height Measurement', String(record.heightMeasurement))}
                {renderSentenceField('Weight Measurement Method', record.weightMeasurementMethod)}
                {renderSentenceField('Obesity Class', record.obesityClass)}
              </View>
            )}

            {/* 2. Weight History */}
            {(hasVal(record.weightStability) || hasVal(record.weightLossHistory) || numShown(record.previousPregnancyWeightGain) || hasVal(record.gestationalWeightGainGoal)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Weight History</Text>
                  {hasVal(record.weightStability) && renderFieldRow('Weight Stability', record.weightStability ? 'Yes' : 'No')}
                  {numShown(record.previousPregnancyWeightGain) && renderFieldRow('Previous Pregnancy Weight Gain', String(record.previousPregnancyWeightGain))}
                  {renderSentenceField('Gestational Weight Gain Goal', record.gestationalWeightGainGoal)}
                </View>
                {renderSentenceField('Weight Loss History', record.weightLossHistory)}
              </View>
            )}

            {/* 3. Risk Factors */}
            {(hasVal(record.metabolicRiskFactors) || hasVal(record.insulinResistanceMarkers) || numShown(record.prePregnancyA1c) || hasVal(record.thyroidFunction) || hasVal(record.cardiovascularRisk) || hasVal(record.sleepApneaRisk) || hasVal(record.nutritionalDeficiencies)) && (
              <View style={styles.section}>
                {Array.isArray(record.metabolicRiskFactors) && record.metabolicRiskFactors.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.metabolicRiskFactors.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Risk Factors</Text>
                    <Text style={styles.fieldLabel}>Metabolic Risk Factors</Text>
                    {record.metabolicRiskFactors.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {renderSentenceField('Insulin Resistance Markers', record.insulinResistanceMarkers, (!Array.isArray(record.metabolicRiskFactors) || record.metabolicRiskFactors.length === 0) ? 'Risk Factors' : undefined)}
                {numShown(record.prePregnancyA1c) && (
                  <View style={styles.fieldBox} wrap={false}>
                    {(!Array.isArray(record.metabolicRiskFactors) || record.metabolicRiskFactors.length === 0) && !hasVal(record.insulinResistanceMarkers) && <Text style={styles.sectionTitle}>Risk Factors</Text>}
                    {renderFieldRow('Pre-Pregnancy A1c', String(record.prePregnancyA1c))}
                  </View>
                )}
                {renderSentenceField('Thyroid Function', record.thyroidFunction)}
                {renderSentenceField('Cardiovascular Risk', record.cardiovascularRisk)}
                {hasVal(record.sleepApneaRisk) && (
                  <View style={styles.fieldBox} wrap={false}>
                    {renderFieldRow('Sleep Apnea Risk', record.sleepApneaRisk ? 'Yes' : 'No')}
                  </View>
                )}
                {Array.isArray(record.nutritionalDeficiencies) && record.nutritionalDeficiencies.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.nutritionalDeficiencies.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Nutritional Deficiencies</Text>
                    {record.nutritionalDeficiencies.filter(Boolean).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 4. Interventions */}
            {(hasVal(record.nutritionalCounseling) || hasVal(record.bariatricSurgeryHistory) || hasVal(record.exerciseTolerance) || hasVal(record.eatingDisorderHistory) || hasVal(record.contraceptiveWeightEffect)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Interventions</Text>
                {hasVal(record.nutritionalCounseling) && renderFieldRow('Nutritional Counseling', record.nutritionalCounseling ? 'Yes' : 'No')}
                {hasVal(record.bariatricSurgeryHistory) && renderFieldRow('Bariatric Surgery History', record.bariatricSurgeryHistory ? 'Yes' : 'No')}
                {renderSentenceField('Exercise Tolerance', record.exerciseTolerance)}
                {hasVal(record.eatingDisorderHistory) && renderFieldRow('Eating Disorder History', record.eatingDisorderHistory ? 'Yes' : 'No')}
                {renderSentenceField('Contraceptive Weight Effect', record.contraceptiveWeightEffect)}
              </View>
            )}
          </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PrePregnancyWeightDocumentPDFTemplate;
