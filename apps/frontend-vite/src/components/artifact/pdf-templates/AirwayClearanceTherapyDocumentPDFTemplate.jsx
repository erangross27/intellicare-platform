/**
 * AirwayClearanceTherapyDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- airway clearance therapy
 * Collection: airway_clearance_therapy
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  recordMeta: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 13, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 13, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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

const consumeTitle = (titleRef) => {
  if (!titleRef || !titleRef.v) return null;
  const t = titleRef.v;
  titleRef.v = null;
  return t;
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  const title = typeof sectionTitle === 'object' ? consumeTitle(sectionTitle) : sectionTitle;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
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

  const title = typeof sectionTitle === 'object' ? consumeTitle(sectionTitle) : sectionTitle;

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
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
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

  const title = typeof sectionTitle === 'object' ? consumeTitle(sectionTitle) : sectionTitle;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const AirwayClearanceTherapyDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.airway_clearance_therapy) return Array.isArray(r.airway_clearance_therapy) ? r.airway_clearance_therapy : [r.airway_clearance_therapy];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.airway_clearance_therapy) return Array.isArray(dd.airway_clearance_therapy) ? dd.airway_clearance_therapy : [dd.airway_clearance_therapy];
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
            <Text style={styles.documentTitle}>Airway Clearance Therapy</Text>
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
          <Text style={styles.documentTitle}>Airway Clearance Therapy</Text>
        </View>

        {records.map((record, index) => {
          const ctr = { n: 1 };

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Airway Clearance Therapy ${index + 1}`}</Text>
                {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
              </View>

              {/* 1. Diagnosis & Oxygenation */}
              {(hasVal(record.primaryDiagnosis) || hasVal(record.baselineSpO2) || hasVal(record.postTherapySpO2) || hasVal(record.supplementalOxygenFlowRate)) && (() => {
                const t1 = { v: 'Diagnosis & Oxygenation' };
                return (
                  <View style={styles.section}>
                    {renderSentenceField('Primary Diagnosis', record.primaryDiagnosis, ctr, t1)}
                    {hasVal(record.baselineSpO2) && renderFieldRow('Baseline SpO2', record.baselineSpO2, t1)}
                    {hasVal(record.postTherapySpO2) && renderFieldRow('Post-Therapy SpO2', record.postTherapySpO2, t1)}
                    {hasVal(record.supplementalOxygenFlowRate) && renderFieldRow('Supplemental O2 Flow Rate', record.supplementalOxygenFlowRate, t1)}
                  </View>
                );
              })()}

              {/* 2. Chest Physiotherapy */}
              {hasVal(record.chestPhysiotherapyTechnique) && (
                <View style={styles.section}>
                  {renderSentenceField('Chest Physiotherapy Technique', record.chestPhysiotherapyTechnique, ctr, 'Chest Physiotherapy')}
                </View>
              )}

              {/* 3. HFCWO */}
              {(hasVal(record.highFrequencyChestWallOscillation) || hasVal(record.hfcwoFrequencySetting) || hasVal(record.hfcwoPressureSetting)) && (() => {
                const t3 = { v: 'High-Frequency Chest Wall Oscillation' };
                return (
                  <View style={styles.section}>
                    {hasVal(record.highFrequencyChestWallOscillation) && renderFieldRow('HFCWO Used', record.highFrequencyChestWallOscillation, t3)}
                    {hasVal(record.hfcwoFrequencySetting) && renderFieldRow('HFCWO Frequency Setting', record.hfcwoFrequencySetting, t3)}
                    {hasVal(record.hfcwoPressureSetting) && renderFieldRow('HFCWO Pressure Setting', record.hfcwoPressureSetting, t3)}
                  </View>
                );
              })()}

              {/* 4. PEP */}
              {(hasVal(record.positivExpiratoryPressureDevice) || hasVal(record.pepResistanceSetting)) && (() => {
                const t4 = { v: 'Positive Expiratory Pressure' };
                return (
                  <View style={styles.section}>
                    {renderSentenceField('PEP Device', record.positivExpiratoryPressureDevice, ctr, t4)}
                    {hasVal(record.pepResistanceSetting) && renderFieldRow('PEP Resistance Setting', record.pepResistanceSetting, t4)}
                  </View>
                );
              })()}

              {/* 5. IPV & MI-E */}
              {(hasVal(record.intrapulmonaryPercussiveVentilation) || hasVal(record.ipvOperatingPressure) || hasVal(record.mechanicalInsufflationExsufflation) || hasVal(record.mieInsufflationPressure) || hasVal(record.mieExsufflationPressure)) && (() => {
                const t5 = { v: 'IPV & Mechanical Insufflation-Exsufflation' };
                return (
                  <View style={styles.section}>
                    {hasVal(record.intrapulmonaryPercussiveVentilation) && renderFieldRow('IPV Used', record.intrapulmonaryPercussiveVentilation, t5)}
                    {hasVal(record.ipvOperatingPressure) && renderFieldRow('IPV Operating Pressure', record.ipvOperatingPressure, t5)}
                    {hasVal(record.mechanicalInsufflationExsufflation) && renderFieldRow('MI-E Used', record.mechanicalInsufflationExsufflation, t5)}
                    {hasVal(record.mieInsufflationPressure) && renderFieldRow('MI-E Insufflation Pressure', record.mieInsufflationPressure, t5)}
                    {hasVal(record.mieExsufflationPressure) && renderFieldRow('MI-E Exsufflation Pressure', record.mieExsufflationPressure, t5)}
                  </View>
                );
              })()}

              {/* 6. Sputum & Cough Flow */}
              {(hasVal(record.sputumProductionVolume) || hasVal(record.sputumCharacteristics) || hasVal(record.preTherapyPeakCoughFlow) || hasVal(record.postTherapyPeakCoughFlow)) && (() => {
                const t6 = { v: 'Sputum & Cough Flow' };
                return (
                  <View style={styles.section}>
                    {hasVal(record.sputumProductionVolume) && renderFieldRow('Sputum Volume (mL)', record.sputumProductionVolume, t6)}
                    {renderSentenceField('Sputum Characteristics', record.sputumCharacteristics, ctr, t6)}
                    {hasVal(record.preTherapyPeakCoughFlow) && renderFieldRow('Pre-Therapy Peak Cough Flow', record.preTherapyPeakCoughFlow, t6)}
                    {hasVal(record.postTherapyPeakCoughFlow) && renderFieldRow('Post-Therapy Peak Cough Flow', record.postTherapyPeakCoughFlow, t6)}
                  </View>
                );
              })()}

              {/* 7. Auscultation Findings */}
              {(hasVal(record.auscultationFindingsPreTherapy) || hasVal(record.auscultationFindingsPostTherapy)) && (() => {
                const t7 = { v: 'Auscultation Findings' };
                return (
                  <View style={styles.section}>
                    {renderSentenceField('Pre-Therapy Auscultation', record.auscultationFindingsPreTherapy, ctr, t7)}
                    {renderSentenceField('Post-Therapy Auscultation', record.auscultationFindingsPostTherapy, ctr, t7)}
                  </View>
                );
              })()}

              {/* 8. Therapy Duration & Tolerance */}
              {(hasVal(record.therapyDurationMinutes) || hasVal(record.posturalDrainagePositions) || hasVal(record.patientToleranceBorgScale) || hasVal(record.adverseEventsObserved)) && (() => {
                const t8 = { v: 'Therapy Duration & Tolerance' };
                return (
                  <View style={styles.section}>
                    {hasVal(record.therapyDurationMinutes) && renderFieldRow('Therapy Duration (min)', record.therapyDurationMinutes, t8)}
                    {Array.isArray(record.posturalDrainagePositions) && renderArrayField('Postural Drainage Positions', record.posturalDrainagePositions, ctr, t8)}
                    {hasVal(record.patientToleranceBorgScale) && renderFieldRow('Borg Scale (Tolerance)', record.patientToleranceBorgScale, t8)}
                    {Array.isArray(record.adverseEventsObserved) && renderArrayField('Adverse Events', record.adverseEventsObserved, ctr, t8)}
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

export default AirwayClearanceTherapyDocumentPDFTemplate;
