/**
 * BronchialHygieneTherapyDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica 26/20/19/15pt (large) -- LETTER size -- bronchial hygiene therapy
 * Collection: bronchial_hygiene_therapy
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 15, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  recordMeta: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 15, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 15, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 15, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef, sectionTitle) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text, sectionTitle);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
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

/* renderArrayField */
const renderArrayField = (label, items, counterRef, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const BronchialHygieneTherapyDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.bronchial_hygiene_therapy) return Array.isArray(r.bronchial_hygiene_therapy) ? r.bronchial_hygiene_therapy : [r.bronchial_hygiene_therapy];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.bronchial_hygiene_therapy) return Array.isArray(dd.bronchial_hygiene_therapy) ? dd.bronchial_hygiene_therapy : [dd.bronchial_hygiene_therapy];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Bronchial Hygiene Therapy</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Bronchial Hygiene Therapy</Text>
        </View>

        {records.map((record, index) => {
          const ctr = { n: 1 };

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Bronchial Hygiene Therapy ${index + 1}`}</Text>
                {record.therapyDate && <Text style={styles.recordMeta}>{formatDate(record.therapyDate)}</Text>}
                {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
              </View>

              {/* 1. Session Information */}
              {(hasVal(record.therapyDate) || hasVal(record.primaryIndication) || hasVal(record.baselineSpO2) || hasVal(record.postTherapySpO2)) && (() => {
                let st = 'Session Information';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasVal(record.therapyDate) && renderFieldRow('Therapy Date', formatDate(record.therapyDate), g())}
                    {hasVal(record.primaryIndication) && renderSentenceField('Primary Indication', record.primaryIndication, ctr, g())}
                    {hasVal(record.baselineSpO2) && renderFieldRow('Baseline SpO2', record.baselineSpO2, g())}
                    {hasVal(record.postTherapySpO2) && renderFieldRow('Post-Therapy SpO2', record.postTherapySpO2, g())}
                  </View>
                );
              })()}

              {/* 2. Chest Physiotherapy */}
              {(hasVal(record.chestPhysiotherapyTechnique) || hasVal(record.posturalDrainagePositions) || hasVal(record.percussionDurationMinutes)) && (() => {
                let st = 'Chest Physiotherapy';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasVal(record.chestPhysiotherapyTechnique) && renderSentenceField('Chest Physiotherapy Technique', record.chestPhysiotherapyTechnique, ctr, g())}
                    {hasVal(record.posturalDrainagePositions) && renderArrayField('Postural Drainage Positions', record.posturalDrainagePositions, ctr, g())}
                    {hasVal(record.percussionDurationMinutes) && renderFieldRow('Percussion Duration (minutes)', record.percussionDurationMinutes, g())}
                  </View>
                );
              })()}

              {/* 3. HFCWO */}
              {(hasVal(record.highFrequencyChestWallOscillation) || hasVal(record.hfcwoFrequencyHz) || hasVal(record.hfcwoPressureLevel)) && (() => {
                let st = 'High-Frequency Chest Wall Oscillation';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasVal(record.highFrequencyChestWallOscillation) && renderFieldRow('HFCWO Performed', record.highFrequencyChestWallOscillation, g())}
                    {hasVal(record.hfcwoFrequencyHz) && renderFieldRow('HFCWO Frequency (Hz)', record.hfcwoFrequencyHz, g())}
                    {hasVal(record.hfcwoPressureLevel) && renderFieldRow('HFCWO Pressure Level', record.hfcwoPressureLevel, g())}
                  </View>
                );
              })()}

              {/* 4. PEP & Breathing Techniques */}
              {(hasVal(record.positiveExpiratoryPressureDevice) || hasVal(record.pepPressureRangeCmH2O) || hasVal(record.activeBreathingCycleCompleted) || hasVal(record.autogenicDrainagePhase)) && (() => {
                let st = 'PEP & Breathing Techniques';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasVal(record.positiveExpiratoryPressureDevice) && renderSentenceField('PEP Device', record.positiveExpiratoryPressureDevice, ctr, g())}
                    {hasVal(record.pepPressureRangeCmH2O) && renderSentenceField('PEP Pressure Range (cmH2O)', record.pepPressureRangeCmH2O, ctr, g())}
                    {hasVal(record.activeBreathingCycleCompleted) && renderFieldRow('Active Breathing Cycle Completed', record.activeBreathingCycleCompleted, g())}
                    {hasVal(record.autogenicDrainagePhase) && renderFieldRow('Autogenic Drainage Phase', record.autogenicDrainagePhase, g())}
                  </View>
                );
              })()}

              {/* 5. MI-E */}
              {(hasVal(record.mechanicalInsufflationExsufflation) || hasVal(record.mieInsufflationPressureCmH2O) || hasVal(record.mieExsufflationPressureCmH2O)) && (() => {
                let st = 'Mechanical Insufflation-Exsufflation';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasVal(record.mechanicalInsufflationExsufflation) && renderFieldRow('MI-E Performed', record.mechanicalInsufflationExsufflation, g())}
                    {hasVal(record.mieInsufflationPressureCmH2O) && renderFieldRow('MI-E Insufflation Pressure (cmH2O)', record.mieInsufflationPressureCmH2O, g())}
                    {hasVal(record.mieExsufflationPressureCmH2O) && renderFieldRow('MI-E Exsufflation Pressure (cmH2O)', record.mieExsufflationPressureCmH2O, g())}
                  </View>
                );
              })()}

              {/* 6. Sputum & Cough Findings */}
              {(hasVal(record.sputumCharacteristics) || hasVal(record.sputumVolumeML) || hasVal(record.preTherapyPeakCoughFlowLPM) || hasVal(record.postTherapyPeakCoughFlowLPM)) && (() => {
                let st = 'Sputum & Cough Findings';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasVal(record.sputumCharacteristics) && renderSentenceField('Sputum Characteristics', record.sputumCharacteristics, ctr, g())}
                    {hasVal(record.sputumVolumeML) && renderFieldRow('Sputum Volume (mL)', record.sputumVolumeML, g())}
                    {hasVal(record.preTherapyPeakCoughFlowLPM) && renderFieldRow('Pre-Therapy Peak Cough Flow (LPM)', record.preTherapyPeakCoughFlowLPM, g())}
                    {hasVal(record.postTherapyPeakCoughFlowLPM) && renderFieldRow('Post-Therapy Peak Cough Flow (LPM)', record.postTherapyPeakCoughFlowLPM, g())}
                  </View>
                );
              })()}

              {/* 7. Auscultation */}
              {(hasVal(record.auscultationFindingsPreTherapy) || hasVal(record.auscultationFindingsPostTherapy)) && (() => {
                let st = 'Auscultation';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasVal(record.auscultationFindingsPreTherapy) && renderSentenceField('Auscultation Findings Pre-Therapy', record.auscultationFindingsPreTherapy, ctr, g())}
                    {hasVal(record.auscultationFindingsPostTherapy) && renderSentenceField('Auscultation Findings Post-Therapy', record.auscultationFindingsPostTherapy, ctr, g())}
                  </View>
                );
              })()}

              {/* 8. Adjunct Therapy & Tolerance */}
              {(hasVal(record.nebulizedMucolyticAgent) || hasVal(record.bronchodilatorPretreatment) || hasVal(record.therapyToleranceScore)) && (() => {
                let st = 'Adjunct Therapy & Tolerance';
                const g = () => { const v = st; st = undefined; return v; };
                return (
                  <View style={styles.section}>
                    {hasVal(record.nebulizedMucolyticAgent) && renderSentenceField('Nebulized Mucolytic Agent', record.nebulizedMucolyticAgent, ctr, g())}
                    {hasVal(record.bronchodilatorPretreatment) && renderSentenceField('Bronchodilator Pretreatment', record.bronchodilatorPretreatment, ctr, g())}
                    {hasVal(record.therapyToleranceScore) && renderFieldRow('Therapy Tolerance Score', record.therapyToleranceScore, g())}
                  </View>
                );
              })()}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default BronchialHygieneTherapyDocumentPDFTemplate;
