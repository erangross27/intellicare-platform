/**
 * WorkplaceAccommodationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica 20/14/12pt — LETTER size — workplace accommodations
 * Collection: workplace_accommodations
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
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

/* renderFieldRow: label + value inside fieldBox — for numbers and booleans */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sectionTitle inside fieldBox */
const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
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
const renderArrayFieldPDF = (label, items, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const WorkplaceAccommodationsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.workplace_accommodations) return Array.isArray(r.workplace_accommodations) ? r.workplace_accommodations : [r.workplace_accommodations];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.workplace_accommodations) return Array.isArray(dd.workplace_accommodations) ? dd.workplace_accommodations : [dd.workplace_accommodations];
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
            <Text style={styles.documentTitle}>Workplace Accommodations</Text>
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
          <Text style={styles.documentTitle}>Workplace Accommodations</Text>
        </View>

        {records.map((record, index) => {
          let counter = 1;

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {record.createdAt && (
                    <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>
                  {`Workplace Accommodations ${index + 1}`}
                </Text>
              </View>

              {/* 1. Record Information */}
              {(hasVal(record.accommodationRequestDate) || hasVal(record.adaQualifyingDisability) || hasVal(record.icd10DiagnosisCodes) || hasVal(record.accommodationDurationMonths)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Record Information</Text>
                    {hasVal(record.accommodationRequestDate) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>Accommodation Request Date</Text>
                        <Text style={styles.fieldValue}>{formatDate(record.accommodationRequestDate)}</Text>
                      </View>
                    )}
                    {hasVal(record.adaQualifyingDisability) && renderFieldRow('ADA Qualifying Disability', record.adaQualifyingDisability)}
                    {hasVal(record.accommodationDurationMonths) && renderFieldRow('Accommodation Duration (Months)', record.accommodationDurationMonths)}
                  </View>
                  {renderArrayFieldPDF('ICD-10 Diagnosis Codes', record.icd10DiagnosisCodes)}
                </View>
              )}

              {/* 2. Functional Assessment */}
              {(hasVal(record.functionalCapacityEvaluation) || hasVal(record.liftingCapacityKg) || hasVal(record.prolongedStandingLimitations) || hasVal(record.ergonomicWorkstationRequired)) && (
                <View style={styles.section}>
                  {hasVal(record.functionalCapacityEvaluation) && renderSentenceField('Functional Capacity Evaluation', record.functionalCapacityEvaluation, 'Functional Assessment')}
                  {!hasVal(record.functionalCapacityEvaluation) && <View style={styles.fieldBox}><Text style={styles.sectionTitle}>Functional Assessment</Text></View>}
                  {hasVal(record.liftingCapacityKg) && renderFieldRow('Lifting Capacity (kg)', record.liftingCapacityKg)}
                  {hasVal(record.prolongedStandingLimitations) && renderSentenceField('Prolonged Standing Limitations', record.prolongedStandingLimitations)}
                  {hasVal(record.ergonomicWorkstationRequired) && renderFieldRow('Ergonomic Workstation Required', record.ergonomicWorkstationRequired)}
                </View>
              )}

              {/* 3. Sensory & Cognitive */}
              {(hasVal(record.visualAcuityCorrection) || hasVal(record.hearingAssistiveTechnology) || hasVal(record.cognitiveAccommodations)) && (
                <View style={styles.section}>
                  {hasVal(record.visualAcuityCorrection) && renderSentenceField('Visual Acuity Correction', record.visualAcuityCorrection, 'Sensory & Cognitive')}
                  {!hasVal(record.visualAcuityCorrection) && hasVal(record.hearingAssistiveTechnology) && renderSentenceField('Hearing Assistive Technology', record.hearingAssistiveTechnology, 'Sensory & Cognitive')}
                  {!hasVal(record.visualAcuityCorrection) && !hasVal(record.hearingAssistiveTechnology) && <View style={styles.fieldBox}><Text style={styles.sectionTitle}>Sensory & Cognitive</Text></View>}
                  {hasVal(record.visualAcuityCorrection) && hasVal(record.hearingAssistiveTechnology) && renderSentenceField('Hearing Assistive Technology', record.hearingAssistiveTechnology)}
                  {renderArrayFieldPDF('Cognitive Accommodations', record.cognitiveAccommodations)}
                </View>
              )}

              {/* 4. Medical Conditions */}
              {(hasVal(record.neurologicalImpairments) || hasVal(record.cardiovascularRestrictions) || hasVal(record.pulmonaryFunctionLimitations) || hasVal(record.diabeticManagementNeeds) || hasVal(record.seizureDisorderPrecautions) || hasVal(record.chemicalSensitivities)) && (
                <View style={styles.section} break={
                  [record.neurologicalImpairments, record.cardiovascularRestrictions, record.pulmonaryFunctionLimitations, record.diabeticManagementNeeds, record.seizureDisorderPrecautions, record.chemicalSensitivities].filter(v => hasVal(v)).length >= 15
                }>
                  {hasVal(record.neurologicalImpairments) && renderSentenceField('Neurological Impairments', record.neurologicalImpairments, 'Medical Conditions')}
                  {!hasVal(record.neurologicalImpairments) && hasVal(record.cardiovascularRestrictions) && renderSentenceField('Cardiovascular Restrictions', record.cardiovascularRestrictions, 'Medical Conditions')}
                  {!hasVal(record.neurologicalImpairments) && !hasVal(record.cardiovascularRestrictions) && <View style={styles.fieldBox}><Text style={styles.sectionTitle}>Medical Conditions</Text></View>}
                  {hasVal(record.neurologicalImpairments) && hasVal(record.cardiovascularRestrictions) && renderSentenceField('Cardiovascular Restrictions', record.cardiovascularRestrictions)}
                  {hasVal(record.pulmonaryFunctionLimitations) && renderSentenceField('Pulmonary Function Limitations', record.pulmonaryFunctionLimitations)}
                  {hasVal(record.diabeticManagementNeeds) && renderSentenceField('Diabetic Management Needs', record.diabeticManagementNeeds)}
                  {hasVal(record.seizureDisorderPrecautions) && renderSentenceField('Seizure Disorder Precautions', record.seizureDisorderPrecautions)}
                  {hasVal(record.chemicalSensitivities) && renderSentenceField('Chemical Sensitivities', record.chemicalSensitivities)}
                </View>
              )}

              {/* 5. Medication & Mobility — title grouped with first array */}
              {(hasVal(record.medicationSideEffects) || hasVal(record.mobilityAssistiveDevices)) && (
                <View style={styles.section}>
                  {hasVal(record.medicationSideEffects) ? (
                    <>
                      {renderArrayFieldPDF('Medication Side Effects', record.medicationSideEffects, 'Medication & Mobility')}
                      {renderArrayFieldPDF('Mobility Assistive Devices', record.mobilityAssistiveDevices)}
                    </>
                  ) : (
                    renderArrayFieldPDF('Mobility Assistive Devices', record.mobilityAssistiveDevices, 'Medication & Mobility')
                  )}
                </View>
              )}

              {/* 6. Psychological */}
              {hasVal(record.psyFunctionalAssessment) && (
                <View style={styles.section}>
                  {renderSentenceField('Psychological Functional Assessment', record.psyFunctionalAssessment, 'Psychological')}
                </View>
              )}

              {/* 7. Return to Work */}
              {(hasVal(record.returnToWorkProgression) || hasVal(record.occupationalTherapyRecommendations)) && (
                <View style={styles.section}>
                  {hasVal(record.returnToWorkProgression) && renderSentenceField('Return to Work Progression', record.returnToWorkProgression, 'Return to Work')}
                  {!hasVal(record.returnToWorkProgression) && hasVal(record.occupationalTherapyRecommendations) && renderSentenceField('Occupational Therapy Recommendations', record.occupationalTherapyRecommendations, 'Return to Work')}
                  {!hasVal(record.returnToWorkProgression) && !hasVal(record.occupationalTherapyRecommendations) && <View style={styles.fieldBox}><Text style={styles.sectionTitle}>Return to Work</Text></View>}
                  {hasVal(record.returnToWorkProgression) && hasVal(record.occupationalTherapyRecommendations) && renderSentenceField('Occupational Therapy Recommendations', record.occupationalTherapyRecommendations)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default WorkplaceAccommodationsDocumentPDFTemplate;
