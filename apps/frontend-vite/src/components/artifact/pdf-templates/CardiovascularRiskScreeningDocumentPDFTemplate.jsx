/**
 * CardiovascularRiskScreeningDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: cardiovascular_risk_screening
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const FL = {
  framinghamRiskScore: 'Framingham', reynoldsRiskScore: 'Reynolds', ascvdRiskScore: 'ASCVD', riskCategory: 'Risk Category',
  systolicBloodPressure: 'Systolic BP', diastolicBloodPressure: 'Diastolic BP',
  totalCholesterol: 'Total Cholesterol', hdlCholesterol: 'HDL', ldlCholesterol: 'LDL', triglycerides: 'Triglycerides',
  fastingGlucose: 'Fasting Glucose', hemoglobinA1c: 'HbA1c', bodyMassIndex: 'BMI', waistCircumference: 'Waist',
  smokingStatus: 'Smoking', physicalActivityLevel: 'Physical Activity',
  diabetesPresent: 'Diabetes', hypertensionPresent: 'Hypertension', familyHistoryCvd: 'Family History CVD',
  onStatinTherapy: 'On Statin', onAntihypertensiveMedication: 'On Antihypertensive', statinRecommended: 'Statin Recommended',
  cReactiveProtein: 'CRP', coronaryCalciumScore: 'Calcium Score', anklebrachialIndex: 'ABI',
};

const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>{title}</Text>{visible.map((f, i) => (<View key={i}><Text style={styles.subSectionTitle}>{FL[f] || f}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>))}</View>);
};

const CardiovascularRiskScreeningDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cardiovascular_risk_screening) return Array.isArray(r.cardiovascular_risk_screening) ? r.cardiovascular_risk_screening : [r.cardiovascular_risk_screening];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiovascular_risk_screening) return Array.isArray(dd.cardiovascular_risk_screening) ? dd.cardiovascular_risk_screening : [dd.cardiovascular_risk_screening]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Cardiovascular Risk Screening</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cardiovascular Risk Screening</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Cardiovascular Risk Screening ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}{record.riskCategory && <Text style={styles.recordMeta}>{record.riskCategory}</Text>}</View>
            {renderFieldGroup('Risk Scores', ['framinghamRiskScore', 'reynoldsRiskScore', 'ascvdRiskScore', 'riskCategory'], record)}
            {renderFieldGroup('Blood Pressure', ['systolicBloodPressure', 'diastolicBloodPressure'], record)}
            {renderFieldGroup('Lipid Panel', ['totalCholesterol', 'hdlCholesterol', 'ldlCholesterol', 'triglycerides'], record)}
            {renderFieldGroup('Metabolic', ['fastingGlucose', 'hemoglobinA1c', 'bodyMassIndex', 'waistCircumference'], record)}
            {renderFieldGroup('Lifestyle', ['smokingStatus', 'physicalActivityLevel'], record)}
            {renderFieldGroup('Medical History', ['diabetesPresent', 'hypertensionPresent', 'familyHistoryCvd'], record)}
            {renderFieldGroup('Treatment', ['onStatinTherapy', 'onAntihypertensiveMedication', 'statinRecommended'], record)}
            {renderFieldGroup('Biomarkers', ['cReactiveProtein', 'coronaryCalciumScore', 'anklebrachialIndex'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CardiovascularRiskScreeningDocumentPDFTemplate;
