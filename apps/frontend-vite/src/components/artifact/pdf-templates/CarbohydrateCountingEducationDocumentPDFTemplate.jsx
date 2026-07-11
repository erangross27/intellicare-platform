/**
 * CarbohydrateCountingEducationDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: carbohydrate_counting_education
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

const FL = {
  patientDiabetesType: 'Diabetes Type', baselineHbA1c: 'Baseline HbA1c',
  carbohydrateCountingCompetency: 'Competency Level', educationSessionDuration: 'Session Duration (min)',
  currentInsulinRegimen: 'Current Insulin Regimen', rapidActingInsulinType: 'Rapid Acting Insulin',
  basalInsulinType: 'Basal Insulin', insulinToCarbohydrateRatio: 'Insulin:Carb Ratio',
  insulinSensitivityFactor: 'Insulin Sensitivity Factor',
  targetGlucoseRange: 'Target Glucose Range', glucometerAccuracy: 'Glucometer Accuracy',
  continuousGlucoseMonitor: 'CGM', timeInRange: 'Time in Range', glycemicVariability: 'Glycemic Variability',
  nutritionLabelReadingSkills: 'Nutrition Label Reading', portionSizeEstimation: 'Portion Size Estimation',
  glycemicIndexKnowledge: 'Glycemic Index Knowledge',
  hypoglycemiaAwareness: 'Hypoglycemia Awareness', severeHypoglycemiaHistory: 'Severe Hypoglycemia History',
  diabeticKetoacidosisHistory: 'DKA History', gastroparesisPresence: 'Gastroparesis',
  followUpRecommendations: 'Follow-Up Recommendations',
};

const renderFieldGroup = (title, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>{title}</Text>{visible.map((f, i) => (<View key={i}><Text style={styles.subSectionTitle}>{FL[f] || f}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>))}</View>);
};

const CarbohydrateCountingEducationDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.carbohydrate_counting_education) return Array.isArray(r.carbohydrate_counting_education) ? r.carbohydrate_counting_education : [r.carbohydrate_counting_education];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.carbohydrate_counting_education) return Array.isArray(dd.carbohydrate_counting_education) ? dd.carbohydrate_counting_education : [dd.carbohydrate_counting_education]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Carbohydrate Counting Education</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Carbohydrate Counting Education</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Carbohydrate Counting Education ${idx + 1}`}</Text></View>
            {renderFieldGroup('Diabetes Overview', ['patientDiabetesType', 'baselineHbA1c', 'carbohydrateCountingCompetency', 'educationSessionDuration'], record)}
            {renderFieldGroup('Insulin Regimen', ['currentInsulinRegimen', 'rapidActingInsulinType', 'basalInsulinType', 'insulinToCarbohydrateRatio', 'insulinSensitivityFactor'], record)}
            {renderFieldGroup('Glucose Targets', ['targetGlucoseRange', 'glucometerAccuracy', 'continuousGlucoseMonitor', 'timeInRange', 'glycemicVariability'], record)}
            {renderFieldGroup('Skills Assessment', ['nutritionLabelReadingSkills', 'portionSizeEstimation', 'glycemicIndexKnowledge'], record)}
            {renderFieldGroup('Medical History', ['hypoglycemiaAwareness', 'severeHypoglycemiaHistory', 'diabeticKetoacidosisHistory', 'gastroparesisPresence'], record)}
            {Array.isArray(record.mealTimingPatterns) && record.mealTimingPatterns.length > 0 && (
              <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Meal Timing</Text>{record.mealTimingPatterns.filter(Boolean).map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}</View>
            )}
            {Array.isArray(record.learningObjectivesAchieved) && record.learningObjectivesAchieved.length > 0 && (
              <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Learning Objectives</Text>{record.learningObjectivesAchieved.filter(Boolean).map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}</View>
            )}
            {hasVal(record.followUpRecommendations) && (
              <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Follow-Up Recommendations</Text>{splitBySentence(fmtVal(record.followUpRecommendations)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CarbohydrateCountingEducationDocumentPDFTemplate;
