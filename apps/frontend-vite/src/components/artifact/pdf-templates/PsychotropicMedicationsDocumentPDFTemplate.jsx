/**
 * PsychotropicMedicationsDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- psychotropic medications
 * Collection: psychotropic_medications
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f1f1f', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#666666', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f1f1f' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1f1f1f', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#666666', textAlign: 'center', marginTop: 40 },
  warningBox: { padding: 8, borderWidth: 1, borderColor: '#555555', backgroundColor: '#f2f2f2', marginBottom: 8 },
  warningLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 2 },
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
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderStringField: uses splitBySentence, parseLabel, splitByComma */
const renderStringFieldPdf = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);

  if (sentences.length <= 1) {
    return renderFieldRow(label, value);
  }

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
                  <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {safeString(ci)}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx} style={{ marginTop: 4 }}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{safeString(parsed.value)}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {safeString(sentence)}</Text>;
      })}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const PsychotropicMedicationsDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  const unwrapData = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.flatMap(item => {
        if (item?.psychotropic_medications) return Array.isArray(item.psychotropic_medications) ? item.psychotropic_medications : [item.psychotropic_medications];
        if (item?.documentData) { const dd = item.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychotropic_medications) return Array.isArray(dd.psychotropic_medications) ? dd.psychotropic_medications : [dd.psychotropic_medications]; return [dd]; }
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (input.psychotropic_medications) return Array.isArray(input.psychotropic_medications) ? input.psychotropic_medications : [input.psychotropic_medications];
    if (input.document) return Array.isArray(input.document) ? input.document : [input.document];
    if (input.data) return Array.isArray(input.data) ? input.data : [input.data];
    return [input];
  };

  const records = unwrapData(templateData);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Psychotropic Medications</Text>
          </View>
          <Text style={styles.noDataText}>No psychotropic medication records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Psychotropic Medications</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.startDate) && <Text style={styles.recordDate}>Start: {formatDate(record.startDate)}</Text>}
                {record.active !== undefined && <Text style={styles.recordDate}>Status: {record.active ? 'Active' : 'Inactive'}</Text>}
              </View>
              <Text style={styles.recordTitle}>{safeString(record.name) || `Psychotropic Medication ${idx + 1}`}</Text>
            </View>

            {/* Medication Information */}
            {(hasVal(record.name) || hasVal(record.genericName) || hasVal(record.dosage) || hasVal(record.frequency) || hasVal(record.route)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Medication Information</Text>
                {renderFieldRow('NAME', record.name)}
                {renderFieldRow('GENERIC NAME', record.genericName)}
                {renderFieldRow('DOSAGE', record.dosage)}
                {renderFieldRow('FREQUENCY', record.frequency)}
                {renderFieldRow('ROUTE', record.route)}
                {record.active !== undefined && renderFieldRow('ACTIVE', record.active)}
              </View>
            )}

            {/* Prescription Details */}
            {(hasVal(record.startDate) || hasVal(record.endDate) || hasVal(record.duration) || (record.durationDays !== undefined && record.durationDays !== null && record.durationDays !== '' && !isNaN(parseFloat(record.durationDays)) && parseFloat(record.durationDays) !== 0) || hasVal(record.durationUnit) || hasVal(record.prescriber) || (record.refills !== undefined && record.refills !== null && record.refills !== '' && !isNaN(parseFloat(record.refills)) && parseFloat(record.refills) !== 0)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Prescription Details</Text>
                {hasVal(record.startDate) && renderFieldRow('START DATE', formatDate(record.startDate))}
                {hasVal(record.endDate) && renderFieldRow('END DATE', formatDate(record.endDate))}
                {renderFieldRow('DURATION', record.duration)}
                {record.durationDays !== undefined && record.durationDays !== null && record.durationDays !== '' && !isNaN(parseFloat(record.durationDays)) && parseFloat(record.durationDays) !== 0 && renderFieldRow('DURATION (DAYS)', String(parseFloat(record.durationDays)))}
                {renderFieldRow('DURATION UNIT', record.durationUnit)}
                {renderFieldRow('PRESCRIBER', record.prescriber)}
                {record.refills !== undefined && record.refills !== null && record.refills !== '' && !isNaN(parseFloat(record.refills)) && parseFloat(record.refills) !== 0 && renderFieldRow('REFILLS', String(parseFloat(record.refills)))}
              </View>
            )}

            {/* Indication & Instructions */}
            {(hasVal(record.indication) || hasVal(record.instructions)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Indication & Instructions</Text>
                {renderStringFieldPdf('INDICATION', record.indication)}
                {renderStringFieldPdf('INSTRUCTIONS', record.instructions)}
              </View>
            )}

            {/* Current Medications */}
            {hasVal(record.current) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Medications</Text>
                {record.current.map((med, i) => {
                  if (typeof med === 'string') {
                    return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(med)}</Text>;
                  }
                  return (
                    <View key={i} style={styles.fieldBox} wrap={false}>
                      <Text style={styles.nestedSubtitle}>{i + 1}. {safeString(med.medication || med.name || `Medication ${i + 1}`)}</Text>
                      {hasVal(med.dose) && <Text style={styles.listItem}>Dose: {safeString(med.dose)}</Text>}
                      {hasVal(med.frequency) && <Text style={styles.listItem}>Frequency: {safeString(med.frequency)}</Text>}
                      {hasVal(med.startDate) && <Text style={styles.listItem}>Started: {safeString(med.startDate)}</Text>}
                      {hasVal(med.response) && <Text style={styles.listItem}>Response: {safeString(med.response)}</Text>}
                      {hasVal(med.sideEffects) && med.sideEffects.length > 0 && <Text style={styles.listItem}>Side Effects: {med.sideEffects.join(', ')}</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Past Medications */}
            {hasVal(record.past) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Past Medications</Text>
                {record.past.map((med, i) => {
                  if (typeof med === 'string') {
                    return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(med)}</Text>;
                  }
                  return (
                    <View key={i} style={styles.fieldBox} wrap={false}>
                      <Text style={styles.nestedSubtitle}>{i + 1}. {safeString(med.medication || med.name || `Medication ${i + 1}`)}</Text>
                      {hasVal(med.maxDose) && <Text style={styles.listItem}>Max Dose: {safeString(med.maxDose)}</Text>}
                      {hasVal(med.duration) && <Text style={styles.listItem}>Duration: {safeString(med.duration)}</Text>}
                      {hasVal(med.reasonStopped) && <Text style={styles.listItem}>Reason Stopped: {safeString(med.reasonStopped)}</Text>}
                      {hasVal(med.efficacy) && <Text style={styles.listItem}>Efficacy: {safeString(med.efficacy)}</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Medication Changes */}
            {hasVal(record.medicationChanges) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Medication Changes</Text>
                {record.medicationChanges.map((change, i) => (
                  <View key={i} style={styles.fieldBox} wrap={false}>
                    <Text style={styles.nestedSubtitle}>{i + 1}. {safeString(change.action || 'Change')}: {safeString(change.medication || '')}</Text>
                    {hasVal(change.dose) && <Text style={styles.listItem}>Dose: {safeString(change.dose)}</Text>}
                    {hasVal(change.reason) && <Text style={styles.listItem}>Reason: {safeString(change.reason)}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Safety & Allergies */}
            {(hasVal(record.sideEffects) || hasVal(record.drugInteractions) || hasVal(record.allergiesAdverse) || hasVal(record.safetyWarning)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Safety & Allergies</Text>

                {hasVal(record.sideEffects) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>SIDE EFFECTS</Text>
                    {record.sideEffects.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                    ))}
                  </View>
                )}

                {hasVal(record.drugInteractions) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>DRUG INTERACTIONS</Text>
                    {record.drugInteractions.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                    ))}
                  </View>
                )}

                {hasVal(record.allergiesAdverse) && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningLabel}>ALLERGIES & ADVERSE REACTIONS</Text>
                    {record.allergiesAdverse.map((item, i) => {
                      const text = typeof item === 'string' ? item : `${item.medication}: ${item.reaction}`;
                      return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(text)}</Text>;
                    })}
                  </View>
                )}

                {hasVal(record.safetyWarning) && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningLabel}>SAFETY WARNING</Text>
                    <Text style={styles.fieldValue}>{safeString(record.safetyWarning)}</Text>
                  </View>
                )}
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PsychotropicMedicationsDocumentPDFTemplate;
