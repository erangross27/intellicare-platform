/**
 * SurgicalConsentFormsDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- surgical consent forms
 * Collection: surgical_consent_forms
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1f2937', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u03bcm/g, 'um');
  str = str.replace(/\u00b5m/g, 'um');
  str = str.replace(/\u00b0/g, ' deg');
  str = str.replace(/\u00b1/g, '+/-');
  str = str.replace(/\u2265/g, '>=');
  str = str.replace(/\u2264/g, '<=');
  str = str.replace(/\u2192/g, '->');
  return str;
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
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

/* ======= FIELD RENDERERS ======= */
const renderSentenceField = (label, val) => {
  if (!hasVal(val)) return null;
  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length <= 1) {
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        <Text style={styles.fieldValue}>{strVal}</Text>
      </View>
    );
  }
  let n = 1;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{safeString(label)}</Text>
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}:</Text>
                {commaItems.map((ci, ciIdx) => (
                  <Text key={ciIdx} style={styles.listItem}>{n++}. {safeString(ci)}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}:</Text>
              <Text style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{n++}. {safeString(sentence)}</Text>;
      })}
    </View>
  );
};

const SurgicalConsentFormsDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  const records = (() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.surgical_consent_forms) return Array.isArray(r.surgical_consent_forms) ? r.surgical_consent_forms : [r.surgical_consent_forms];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.surgical_consent_forms) return Array.isArray(dd.surgical_consent_forms) ? dd.surgical_consent_forms : [dd.surgical_consent_forms]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  })();

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Surgical Consent Forms</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Surgical Consent Forms</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {record.createdAt && <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>}
              </View>
              <Text style={styles.recordTitle}>{safeString(record.plannedProcedure || `Surgical Consent Form ${idx + 1}`)}</Text>
            </View>

            {/* Consent Information */}
            {(hasVal(record.consentDate) || hasVal(record.consentType) || hasVal(record.decisionMaker) || hasVal(record.obtainingProvider)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Consent Information</Text>
                {hasVal(record.consentDate) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Consent Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.consentDate)}</Text>
                  </View>
                )}
                {hasVal(record.consentType) && renderSentenceField('Consent Type', record.consentType)}
                {hasVal(record.decisionMaker) && renderSentenceField('Decision Maker', record.decisionMaker)}
                {hasVal(record.obtainingProvider) && renderSentenceField('Obtaining Provider', record.obtainingProvider)}
              </View>
            )}

            {/* Procedure Details */}
            {(hasVal(record.plannedProcedure) || hasVal(record.alternativeName) || hasVal(record.indication)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Procedure Details</Text>
                {hasVal(record.plannedProcedure) && renderSentenceField('Planned Procedure', record.plannedProcedure)}
                {hasVal(record.alternativeName) && renderSentenceField('Alternative Name', record.alternativeName)}
                {hasVal(record.indication) && renderSentenceField('Indication', record.indication)}
              </View>
            )}

            {/* Risks Discussed */}
            {hasVal(record.risksDiscussed) && record.risksDiscussed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Risks Discussed</Text>
                {record.risksDiscussed.map((risk, rIdx) => (
                  <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {safeString(risk)}</Text>
                ))}
              </View>
            )}

            {/* Benefits Discussed */}
            {hasVal(record.benefitsDiscussed) && record.benefitsDiscussed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Benefits Discussed</Text>
                {record.benefitsDiscussed.map((benefit, bIdx) => (
                  <Text key={bIdx} style={styles.listItem}>{bIdx + 1}. {safeString(benefit)}</Text>
                ))}
              </View>
            )}

            {/* Alternatives Discussed */}
            {hasVal(record.alternativesDiscussed) && record.alternativesDiscussed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Alternatives Discussed</Text>
                {record.alternativesDiscussed.map((alt, aIdx) => (
                  <Text key={aIdx} style={styles.listItem}>{aIdx + 1}. {safeString(alt)}</Text>
                ))}
              </View>
            )}

            {/* Specific Risks */}
            {(hasVal(record.specificRisks) || hasVal(record.anesthesiaRisks)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Specific Risks</Text>
                {hasVal(record.specificRisks) && renderSentenceField('Specific Risks', record.specificRisks)}
                {hasVal(record.anesthesiaRisks) && renderSentenceField('Anesthesia Risks', record.anesthesiaRisks)}
              </View>
            )}

            {/* Transfusion & Patient Questions */}
            {(hasVal(record.bloodTransfusion) || hasVal(record.patientQuestions) || hasVal(record.patientUnderstanding)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Transfusion & Patient Questions</Text>
                {hasVal(record.bloodTransfusion) && renderSentenceField('Blood Transfusion', record.bloodTransfusion)}
                {hasVal(record.patientQuestions) && renderSentenceField('Patient Questions', record.patientQuestions)}
                {hasVal(record.patientUnderstanding) && renderSentenceField('Patient Understanding', record.patientUnderstanding)}
              </View>
            )}

            {/* Consent Process */}
            {(hasVal(record.interpreterUsed) || hasVal(record.witnessPresent)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Consent Process</Text>
                {hasVal(record.interpreterUsed) && renderSentenceField('Interpreter Used', record.interpreterUsed)}
                {hasVal(record.witnessPresent) && renderSentenceField('Witness Present', record.witnessPresent)}
              </View>
            )}

            {/* Signatures */}
            {(hasVal(record.patientSignature) || hasVal(record.providerSignature)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Signatures</Text>
                {hasVal(record.patientSignature) && renderSentenceField('Patient Signature', record.patientSignature)}
                {hasVal(record.providerSignature) && renderSentenceField('Provider Signature', record.providerSignature)}
              </View>
            )}

            {/* Recommendations */}
            {hasVal(record.recommendations) && record.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {(() => {
                  const groupedByDate = {};
                  record.recommendations.forEach((rec, recIdx) => {
                    const date = rec.date || 'No Date';
                    if (!groupedByDate[date]) groupedByDate[date] = [];
                    groupedByDate[date].push({ ...rec, recText: rec.recommendation || String(rec) });
                  });
                  return Object.entries(groupedByDate).map(([date, recs], dateIdx) => (
                    <View key={dateIdx} style={{ marginBottom: 10 }}>
                      <Text style={styles.nestedSubtitle}>{safeString(date)}</Text>
                      {recs.map((rec, rIdx) => (
                        <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {safeString(rec.recText)}</Text>
                      ))}
                    </View>
                  ));
                })()}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SurgicalConsentFormsDocumentPDFTemplate;
