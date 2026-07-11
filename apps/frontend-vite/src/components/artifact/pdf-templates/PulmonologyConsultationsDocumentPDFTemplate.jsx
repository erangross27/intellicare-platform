/**
 * PulmonologyConsultationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — pulmonology consultations
 * Collection: pulmonology_consultations
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  medicationCard: { marginBottom: 12, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#404040', borderLeftStyle: 'solid' },
  medicationLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2 },
  medicationContent: { fontSize: 11, color: '#1f2937', lineHeight: 1.5 },
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
  if (typeof val === 'string') return val.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2014/g, '-').replace(/\u2013/g, '-').replace(/\u2026/g, '...').replace(/[\u00A0]/g, ' ');
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
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
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* humanizeKey: camelCase sub-key -> "Title Case" label (for smokingCessation / results objects) */
const humanizeKey = (key) => String(key || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

/* renderDynamicObject: recursively render a dynamic-key object (e.g. `results`) as
   humanized label + typed leaf, content-gated, never "[object Object]". */
const renderDynamicObject = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([k, v]) => k !== '_id' && k !== '$oid' && hasVal(v));
  if (entries.length === 0) return null;
  return entries.map(([k, v], i) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && !v.$date) {
      const inner = renderDynamicObject(v, depth + 1);
      if (!inner) return null;
      return (
        <View key={`${depth}-${k}-${i}`} style={{ marginTop: 4, marginBottom: 2, paddingLeft: depth > 0 ? 8 : 0 }}>
          <Text style={styles.nestedSubtitle}>{humanizeKey(k)}</Text>
          {inner}
        </View>
      );
    }
    if (Array.isArray(v)) {
      return (
        <View key={`${depth}-${k}-${i}`} style={{ marginTop: 4, paddingLeft: depth > 0 ? 8 : 0 }}>
          <Text style={styles.nestedSubtitle}>{humanizeKey(k)}</Text>
          {v.filter(item => hasVal(item)).map((item, ii) => (
            <Text key={ii} style={styles.listItem}>{ii + 1}. {safeString(item)}</Text>
          ))}
        </View>
      );
    }
    return (
      <View key={`${depth}-${k}-${i}`} style={[styles.fieldBox, depth > 0 ? { paddingLeft: 8 } : null]}>
        <Text style={styles.fieldLabel}>{humanizeKey(k)}</Text>
        <Text style={styles.fieldValue}>{safeString(v)}</Text>
      </View>
    );
  });
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

/* renderSentenceField: multi-sentence string with parseLabel/splitByComma */
const renderSentenceField = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = safeString(value);
  const sentences = splitBySentence(strVal);
  if (sentences.length <= 1) return renderFieldRow(label, value);

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            return (
              <View key={sIdx} style={{ marginTop: 4 }}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                {commaItems.map((ci, ciIdx) => (
                  <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {ci}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx} style={{ marginTop: 4 }}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>;
      })}
    </View>
  );
};

/* ======= DATA UNWRAP ======= */
const unwrapData = (templateData) => {
  if (!templateData) return [];
  if (Array.isArray(templateData)) {
    return templateData.flatMap((item) => {
      if (item.pulmonology_consultations) return Array.isArray(item.pulmonology_consultations) ? item.pulmonology_consultations : [item.pulmonology_consultations];
      if (item.documentData) { const dd = item.documentData; if (Array.isArray(dd)) return dd; if (dd?.pulmonology_consultations) return Array.isArray(dd.pulmonology_consultations) ? dd.pulmonology_consultations : [dd.pulmonology_consultations]; return [dd]; }
      if (item.records) return item.records;
      return item;
    });
  }
  if (templateData.data) {
    if (Array.isArray(templateData.data)) {
      return templateData.data.flatMap((item) => {
        if (item.pulmonology_consultations) return item.pulmonology_consultations;
        if (item.records) return item.records;
        return item;
      });
    }
    return [templateData.data];
  }
  if (templateData.pulmonology_consultations) return Array.isArray(templateData.pulmonology_consultations) ? templateData.pulmonology_consultations : [templateData.pulmonology_consultations];
  if (templateData.records) return templateData.records;
  return [templateData];
};

const PulmonologyConsultationsDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  const records = unwrapData(templateData);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pulmonology Consultations</Text>
          </View>
          <Text style={styles.noDataText}>No pulmonology consultation records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Pulmonology Consultations</Text>
        </View>
        {records.map((record, idx) => (
          <View key={record._id?.$oid || idx} style={styles.recordContainer} wrap={false}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                <Text style={styles.recordTitle}>{safeString(record.type || `Pulmonology Consultation ${idx + 1}`)}</Text>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>
            </View>

            {/* Visit Information */}
            {(hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Visit Information</Text>
                {renderFieldRow('Provider', record.provider)}
                {renderFieldRow('Facility', record.facility)}
                {renderFieldRow('Status', record.status)}
              </View>
            )}

            {/* Diagnosis */}
            {(hasVal(record.primaryDiagnosis) || hasVal(record.severity) || hasVal(record.exacerbationRisk)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Diagnosis</Text>
                {renderSentenceField('Primary Diagnosis', record.primaryDiagnosis)}
                {renderSentenceField('Severity', record.severity)}
                {renderSentenceField('Exacerbation Risk', record.exacerbationRisk)}
              </View>
            )}

            {/* Secondary Diagnoses */}
            {Array.isArray(record.secondaryDiagnoses) && record.secondaryDiagnoses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Secondary Diagnoses</Text>
                {record.secondaryDiagnoses.map((diag, dIdx) => (
                  <Text key={dIdx} style={styles.listItem}>{dIdx + 1}. {safeString(diag)}</Text>
                ))}
              </View>
            )}

            {/* Pulmonary Function Tests */}
            {(hasVal(record.pulmonaryFunctionTests?.fev1) || hasVal(record.pulmonaryFunctionTests?.fvc) || hasVal(record.pulmonaryFunctionTests?.fev1FvcRatio) || hasVal(record.pulmonaryFunctionTests?.interpretation) || hasVal(record.peakFlow)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pulmonary Function Tests</Text>
                {renderSentenceField('FEV1', record.pulmonaryFunctionTests?.fev1)}
                {renderFieldRow('FVC', record.pulmonaryFunctionTests?.fvc)}
                {renderFieldRow('FEV1/FVC Ratio', record.pulmonaryFunctionTests?.fev1FvcRatio)}
                {renderSentenceField('Interpretation', record.pulmonaryFunctionTests?.interpretation)}
                {renderFieldRow('Peak Flow', record.peakFlow)}
              </View>
            )}

            {/* Arterial Blood Gas */}
            {record.arterialBloodGas && typeof record.arterialBloodGas === 'object' &&
              (hasVal(record.arterialBloodGas.pH) || hasVal(record.arterialBloodGas.paCO2) || hasVal(record.arterialBloodGas.paO2) || hasVal(record.arterialBloodGas.hco3) || hasVal(record.arterialBloodGas.interpretation)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Arterial Blood Gas</Text>
                {hasVal(record.arterialBloodGas.pH) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>pH</Text>
                    <Text style={styles.fieldValue}>{safeString(record.arterialBloodGas.pH)}</Text>
                  </View>
                )}
                {hasVal(record.arterialBloodGas.paCO2) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>paCO2</Text>
                    <Text style={styles.fieldValue}>{safeString(record.arterialBloodGas.paCO2)}</Text>
                  </View>
                )}
                {hasVal(record.arterialBloodGas.paO2) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>paO2</Text>
                    <Text style={styles.fieldValue}>{safeString(record.arterialBloodGas.paO2)}</Text>
                  </View>
                )}
                {hasVal(record.arterialBloodGas.hco3) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>HCO3</Text>
                    <Text style={styles.fieldValue}>{safeString(record.arterialBloodGas.hco3)}</Text>
                  </View>
                )}
                {renderSentenceField('Interpretation', record.arterialBloodGas.interpretation)}
              </View>
            )}

            {/* Respiratory Vitals */}
            {(hasVal(record.respiratoryRate) || hasVal(record.oxygenSaturation)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Respiratory Vitals</Text>
                {hasVal(record.respiratoryRate) && record.respiratoryRate > 0 && renderFieldRow('Respiratory Rate', `${record.respiratoryRate} breaths/min`)}
                {hasVal(record.oxygenSaturation) && record.oxygenSaturation > 0 && renderFieldRow('Oxygen Saturation (SpO2)', `${record.oxygenSaturation}%`)}
              </View>
            )}

            {/* Oxygen Therapy */}
            {record.oxygenTherapy && typeof record.oxygenTherapy === 'object' &&
              (record.oxygenTherapy.prescribed === true || hasVal(record.oxygenTherapy.deliveryMethod) || hasVal(record.oxygenTherapy.flowRate) || hasVal(record.oxygenTherapy.duration)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Oxygen Therapy</Text>
                {record.oxygenTherapy.prescribed === true && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>Prescribed</Text>
                    <Text style={styles.fieldValue}>Yes</Text>
                  </View>
                )}
                {hasVal(record.oxygenTherapy.deliveryMethod) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>Delivery Method</Text>
                    <Text style={styles.fieldValue}>{safeString(record.oxygenTherapy.deliveryMethod)}</Text>
                  </View>
                )}
                {hasVal(record.oxygenTherapy.flowRate) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>Flow Rate</Text>
                    <Text style={styles.fieldValue}>{safeString(record.oxygenTherapy.flowRate)}</Text>
                  </View>
                )}
                {hasVal(record.oxygenTherapy.duration) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>Duration</Text>
                    <Text style={styles.fieldValue}>{safeString(record.oxygenTherapy.duration)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Symptoms */}
            {(hasVal(record.breathingSounds) || hasVal(record.chestPain) ||
              (record.cough && typeof record.cough === 'object' && (hasVal(record.cough.type) || hasVal(record.cough.sputum))) ||
              (record.dyspnea && typeof record.dyspnea === 'object' && (hasVal(record.dyspnea.severity) || hasVal(record.dyspnea.triggers) || typeof record.dyspnea.mMRCScale === 'number'))) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Symptoms</Text>
                {renderSentenceField('Breathing Sounds', record.breathingSounds)}
                {renderSentenceField('Chest Pain', record.chestPain)}
                {record.cough && typeof record.cough === 'object' && (hasVal(record.cough.type) || hasVal(record.cough.sputum)) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.nestedSubtitle}>Cough</Text>
                    {hasVal(record.cough.type) && <Text style={styles.listItem}>Type: {safeString(record.cough.type)}</Text>}
                    {hasVal(record.cough.sputum) && <Text style={styles.listItem}>Sputum: {safeString(record.cough.sputum)}</Text>}
                  </View>
                )}
                {record.dyspnea && typeof record.dyspnea === 'object' && (hasVal(record.dyspnea.severity) || hasVal(record.dyspnea.triggers) || typeof record.dyspnea.mMRCScale === 'number') && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.nestedSubtitle}>Dyspnea</Text>
                    {hasVal(record.dyspnea.severity) && <Text style={styles.listItem}>Severity: {safeString(record.dyspnea.severity)}</Text>}
                    {hasVal(record.dyspnea.triggers) && <Text style={styles.listItem}>Triggers: {safeString(record.dyspnea.triggers)}</Text>}
                    {typeof record.dyspnea.mMRCScale === 'number' && <Text style={styles.listItem}>mMRC {record.dyspnea.mMRCScale}</Text>}
                  </View>
                )}
              </View>
            )}

            {/* Respiratory Medications */}
            {Array.isArray(record.respiratoryMedications) && record.respiratoryMedications.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Respiratory Medications</Text>
                {record.respiratoryMedications.map((med, mIdx) => (
                  <Text key={mIdx} style={styles.listItem}>{mIdx + 1}. {safeString(med)}</Text>
                ))}
              </View>
            )}

            {/* Bronchodilators */}
            {Array.isArray(record.bronchodilators) && record.bronchodilators.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bronchodilators</Text>
                {record.bronchodilators.map((med, mIdx) => (
                  <View key={mIdx} style={styles.medicationCard} wrap={false}>
                    <Text style={styles.medicationLabel}>{mIdx + 1}. {safeString(med.medication || 'Bronchodilator')} ({safeString(med.type)})</Text>
                    {hasVal(med.dose) && <Text style={styles.medicationContent}>Dose: {safeString(med.dose)}</Text>}
                    {hasVal(med.device) && <Text style={styles.medicationContent}>Device: {safeString(med.device)}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Corticosteroids */}
            {Array.isArray(record.corticosteroids) && record.corticosteroids.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Corticosteroids</Text>
                {record.corticosteroids.map((med, mIdx) => (
                  <View key={mIdx} style={styles.medicationCard} wrap={false}>
                    <Text style={styles.medicationLabel}>{mIdx + 1}. {safeString(med.medication || 'Corticosteroid')}</Text>
                    {hasVal(med.route) && <Text style={styles.medicationContent}>Route: {safeString(med.route)}</Text>}
                    {hasVal(med.dose) && <Text style={styles.medicationContent}>Dose: {safeString(med.dose)}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Smoking History */}
            {(hasVal(record.smokingStatus) || (hasVal(record.packYears) && record.packYears > 0) || hasVal(record.quitDate)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Smoking History</Text>
                {renderFieldRow('Smoking Status', record.smokingStatus)}
                {hasVal(record.packYears) && record.packYears > 0 && renderFieldRow('Pack Years', record.packYears)}
                {hasVal(record.quitDate) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>Quit Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.quitDate)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Smoking Cessation */}
            {record.smokingCessation && typeof record.smokingCessation === 'object' && !Array.isArray(record.smokingCessation) &&
              Object.entries(record.smokingCessation).filter(([k, v]) => k !== '_id' && hasVal(v)).length > 0 && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Smoking Cessation</Text>
                {Object.entries(record.smokingCessation).filter(([k, v]) => k !== '_id' && hasVal(v)).map(([k, v], scIdx) => (
                  <View key={scIdx} style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>{humanizeKey(k)}</Text>
                    <Text style={styles.fieldValue}>{safeString(v)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Imaging */}
            {(hasVal(record.chestXrayFindings) || hasVal(record.ctScanFindings) || hasVal(record.imagingDate)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Imaging</Text>
                {renderSentenceField('Chest X-ray Findings', record.chestXrayFindings)}
                {renderSentenceField('CT Scan Findings', record.ctScanFindings)}
                {hasVal(record.imagingDate) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.fieldLabel}>Imaging Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.imagingDate)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Assessment & Plan */}
            {(hasVal(record.assessment) || hasVal(record.plan) || hasVal(record.findings) || hasVal(record.notes)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assessment & Plan</Text>
                {renderSentenceField('Assessment', record.assessment)}
                {renderSentenceField('Plan', record.plan)}
                {renderSentenceField('Findings', record.findings)}
                {renderSentenceField('Notes', record.notes)}
              </View>
            )}

            {/* Results (dynamic-key object) */}
            {record.results && typeof record.results === 'object' && !Array.isArray(record.results) &&
              Object.entries(record.results).filter(([k, v]) => k !== '_id' && hasVal(v)).length > 0 && (
              <View style={styles.section} wrap={Object.keys(record.results).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Results</Text>
                {renderDynamicObject(record.results)}
              </View>
            )}

            {/* Recommendations */}
            {Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {record.recommendations.map((rec, rIdx) => (
                  <View key={rIdx} style={styles.medicationCard} wrap={false}>
                    <Text style={styles.medicationLabel}>{rIdx + 1}. {safeString(typeof rec === 'string' ? rec : rec.recommendation)}</Text>
                    {typeof rec === 'object' && rec.date && <Text style={styles.medicationContent}>Date: {formatDate(rec.date)}</Text>}
                  </View>
                ))}
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PulmonologyConsultationsDocumentPDFTemplate;
