/**
 * PostpartumDiabetesRiskDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: postpartum_diabetes_risk
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
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
  listItem: { fontSize: 12, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
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
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text);
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

/* ======= COMPONENT ======= */
const PostpartumDiabetesRiskDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.postpartum_diabetes_risk) return Array.isArray(r.postpartum_diabetes_risk) ? r.postpartum_diabetes_risk : [r.postpartum_diabetes_risk];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.postpartum_diabetes_risk) return Array.isArray(dd.postpartum_diabetes_risk) ? dd.postpartum_diabetes_risk : [dd.postpartum_diabetes_risk];
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
            <Text style={styles.title}>Postpartum Diabetes Risk</Text>
          </View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Postpartum Diabetes Risk</Text>
        </View>

        {records.map((record, idx) => {
          const ctr = { n: 1 };

          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Postpartum Diabetes Risk ${idx + 1}`}</Text>
                {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
              </View>

              {/* 1. Glucose Metrics */}
              {(hasVal(record.oralGlucoseToleranceTest) || hasVal(record.fastingPlasmaGlucose) || hasVal(record.hemoglobinA1c) || hasVal(record.postpartumScreeningDate)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Glucose Metrics</Text>
                  {renderSentenceField('Oral Glucose Tolerance Test', record.oralGlucoseToleranceTest, ctr)}
                  {renderSentenceField('Fasting Plasma Glucose', record.fastingPlasmaGlucose, ctr)}
                  {renderSentenceField('Hemoglobin A1c', record.hemoglobinA1c, ctr)}
                  {hasVal(record.postpartumScreeningDate) && renderFieldRow('Postpartum Screening Date', formatDate(record.postpartumScreeningDate))}
                </View>
              )}

              {/* 2. Risk Factors */}
              {(hasVal(record.gestationalDiabetesHistory) || hasVal(record.familyHistoryDiabetes) || hasVal(record.polycysticOvarySyndrome) || hasVal(record.insulinTherapyDuringPregnancy) || hasVal(record.macrosomiaHistory) || hasVal(record.previousStillbirth) || hasVal(record.hypertensiveDisorders)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Risk Factors</Text>
                  {renderSentenceField('Gestational Diabetes History', record.gestationalDiabetesHistory, ctr)}
                  {renderSentenceField('Family History of Diabetes', record.familyHistoryDiabetes, ctr)}
                  {renderSentenceField('Polycystic Ovary Syndrome', record.polycysticOvarySyndrome, ctr)}
                  {renderSentenceField('Insulin Therapy During Pregnancy', record.insulinTherapyDuringPregnancy, ctr)}
                  {renderSentenceField('Macrosomia History', record.macrosomiaHistory, ctr)}
                  {renderSentenceField('Previous Stillbirth', record.previousStillbirth, ctr)}
                  {renderSentenceField('Hypertensive Disorders', record.hypertensiveDisorders, ctr)}
                </View>
              )}

              {/* 3. Metabolic Profile */}
              {(hasVal(record.prepregnancyBmi) || hasVal(record.currentBmi) || hasVal(record.gestationalWeightGain) || hasVal(record.triglycerideLevels) || hasVal(record.hdlCholesterol) || hasVal(record.metabolicSyndrome)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Metabolic Profile</Text>
                  {renderSentenceField('Pre-Pregnancy BMI', record.prepregnancyBmi, ctr)}
                  {renderSentenceField('Current BMI', record.currentBmi, ctr)}
                  {renderSentenceField('Gestational Weight Gain', record.gestationalWeightGain, ctr)}
                  {renderSentenceField('Triglyceride Levels', record.triglycerideLevels, ctr)}
                  {renderSentenceField('HDL Cholesterol', record.hdlCholesterol, ctr)}
                  {renderSentenceField('Metabolic Syndrome', record.metabolicSyndrome, ctr)}
                </View>
              )}

              {/* 4. Current Status */}
              {(hasVal(record.breastfeedingStatus) || hasVal(record.ethnicRiskGroup) || hasVal(record.maternalAge) || hasVal(record.thyroidDisorders) || hasVal(record.corticosteroidUse) || hasVal(record.contraceptiveMethod)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Current Status</Text>
                  {renderSentenceField('Breastfeeding Status', record.breastfeedingStatus, ctr)}
                  {renderSentenceField('Ethnic Risk Group', record.ethnicRiskGroup, ctr)}
                  {renderSentenceField('Maternal Age', record.maternalAge, ctr)}
                  {renderSentenceField('Thyroid Disorders', record.thyroidDisorders, ctr)}
                  {renderSentenceField('Corticosteroid Use', record.corticosteroidUse, ctr)}
                  {renderSentenceField('Contraceptive Method', record.contraceptiveMethod, ctr)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PostpartumDiabetesRiskDocumentPDFTemplate;
