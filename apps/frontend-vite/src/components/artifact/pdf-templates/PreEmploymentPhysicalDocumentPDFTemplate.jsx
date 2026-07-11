/**
 * PreEmploymentPhysicalDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: pre_employment_physical
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
  listItem: { fontSize: 12, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArray = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

const formatDate = (d) => {
  if (!d) return '';
  try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
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
  const result = []; let current = ''; let depth = 0; let inQuote = false; let quoteChar = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === '"' || ch === "'") && !inQuote) { inQuote = true; quoteChar = ch; current += ch; }
    else if (ch === quoteChar && inQuote) { inQuote = false; quoteChar = ''; current += ch; }
    else if (ch === '(' && !inQuote) { depth++; current += ch; }
    else if (ch === ')' && !inQuote) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && !inQuote) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split for heavy text fields, with numbering */
const renderSentenceField = (title, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let counter = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counter++ }); });
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counter++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{title}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

const PreEmploymentPhysicalDocumentPDFTemplate = ({ document: data }) => {
  /* Handle data unwrapping */
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.pre_employment_physical && Array.isArray(data.pre_employment_physical)) {
    records = data.pre_employment_physical;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.pre_employment_physical) {
      records = docData.pre_employment_physical;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Pre-Employment Physical</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Pre-Employment Physical</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Pre-Employment Physical ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>

            {/* 1. Employment Information */}
            {(hasVal(record.date) || hasVal(record.jobTitle) || hasVal(record.employerName) || hasVal(record.examiningPhysician) || hasVal(record.certificationExpirationDate)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Employment Information</Text>
                {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                {renderFieldRow('Job Title', record.jobTitle)}
                {renderFieldRow('Employer Name', record.employerName)}
                {renderFieldRow('Examining Physician', record.examiningPhysician)}
                {hasVal(record.certificationExpirationDate) && renderFieldRow('Certification Expiration Date', formatDate(record.certificationExpirationDate))}
              </View>
            )}

            {/* 2. Clearance Status */}
            {(hasVal(record.medicalClearanceStatus) || hasVal(record.workRestrictions) || hasVal(record.accommodationsRequired) || hasVal(record.dotPhysicalCompliant)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Clearance Status</Text>
                {hasVal(record.medicalClearanceStatus) && renderSentenceField('Medical Clearance Status', record.medicalClearanceStatus)}
                {safeArray(record.workRestrictions).length > 0 && (
                  <View style={styles.fieldBox} wrap={safeArray(record.workRestrictions).length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Work Restrictions</Text>
                    {safeArray(record.workRestrictions).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                    ))}
                  </View>
                )}
                {hasVal(record.accommodationsRequired) && renderSentenceField('Accommodations Required', record.accommodationsRequired)}
                {hasVal(record.dotPhysicalCompliant) && renderFieldRow('DOT Physical Compliant', record.dotPhysicalCompliant)}
              </View>
            )}

            {/* 3. Screenings */}
            {(hasVal(record.drugScreenRequired) || hasVal(record.drugScreenResult) || hasVal(record.tuberculosisScreening)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Screenings</Text>
                {hasVal(record.drugScreenRequired) && renderFieldRow('Drug Screen Required', record.drugScreenRequired)}
                {renderFieldRow('Drug Screen Result', record.drugScreenResult)}
                {hasVal(record.tuberculosisScreening) && renderSentenceField('Tuberculosis Screening', record.tuberculosisScreening)}
              </View>
            )}

            {/* 4. Physical Assessment */}
            {(hasVal(record.bloodPressureReading) || hasVal(record.bodyMassIndex) || hasVal(record.musculoskeletalExam) || hasVal(record.liftingCapacity) || hasVal(record.cardiovascularFitness)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Physical Assessment</Text>
                {renderFieldRow('Blood Pressure Reading', record.bloodPressureReading)}
                {hasVal(record.bodyMassIndex) && renderFieldRow('Body Mass Index', record.bodyMassIndex)}
                {hasVal(record.musculoskeletalExam) && renderSentenceField('Musculoskeletal Exam', record.musculoskeletalExam)}
                {hasVal(record.liftingCapacity) && renderSentenceField('Lifting Capacity', record.liftingCapacity)}
                {hasVal(record.cardiovascularFitness) && renderSentenceField('Cardiovascular Fitness', record.cardiovascularFitness)}
              </View>
            )}

            {/* 5. Sensory Evaluation */}
            {(hasVal(record.hearingAcuityTest) || hasVal(record.visionAcuityTest)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Sensory Evaluation</Text>
                {hasVal(record.hearingAcuityTest) && renderSentenceField('Hearing Acuity Test', record.hearingAcuityTest)}
                {hasVal(record.visionAcuityTest) && renderSentenceField('Vision Acuity Test', record.visionAcuityTest)}
              </View>
            )}

            {/* 6. Respiratory Evaluation */}
            {(hasVal(record.respiratoryFitTest) || hasVal(record.respiratorClearance)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Respiratory Evaluation</Text>
                {hasVal(record.respiratoryFitTest) && renderSentenceField('Respiratory Fit Test', record.respiratoryFitTest)}
                {hasVal(record.respiratorClearance) && renderFieldRow('Respirator Clearance', record.respiratorClearance)}
              </View>
            )}

            {/* 7. Medical History */}
            {(hasVal(record.jobPhysicalDemands) || hasVal(record.chronicConditionsDisclosed) || hasVal(record.hazardousExposureHistory) || hasVal(record.immunizationStatus)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Medical History</Text>
                {safeArray(record.jobPhysicalDemands).length > 0 && (
                  <View style={styles.fieldBox} wrap={safeArray(record.jobPhysicalDemands).length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Job Physical Demands</Text>
                    {safeArray(record.jobPhysicalDemands).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                    ))}
                  </View>
                )}
                {safeArray(record.chronicConditionsDisclosed).length > 0 && (
                  <View style={styles.fieldBox} wrap={safeArray(record.chronicConditionsDisclosed).length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Chronic Conditions Disclosed</Text>
                    {safeArray(record.chronicConditionsDisclosed).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                    ))}
                  </View>
                )}
                {safeArray(record.hazardousExposureHistory).length > 0 && (
                  <View style={styles.fieldBox} wrap={safeArray(record.hazardousExposureHistory).length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Hazardous Exposure History</Text>
                    {safeArray(record.hazardousExposureHistory).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                    ))}
                  </View>
                )}
                {safeArray(record.immunizationStatus).length > 0 && (
                  <View style={styles.fieldBox} wrap={safeArray(record.immunizationStatus).length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Immunization Status</Text>
                    {safeArray(record.immunizationStatus).map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PreEmploymentPhysicalDocumentPDFTemplate;
