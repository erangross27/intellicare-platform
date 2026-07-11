/**
 * BreastfeedingRecommendationDocumentPDFTemplate.jsx
 * Helvetica 23/18/16/13pt -- LETTER size -- US medical platform
 * Collection: breastfeeding_recommendation
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 23, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 12, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 13, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 13, lineHeight: 1.5, marginBottom: 2 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ======= UTILS ======= */
const formatDate = (d) => {
  if (!d) return '';
  try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(d); }
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

/* Fix 3: Quote-aware splitByComma */
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

/* Number fields where a value of 0 means "not measured/not recorded" (0 here is biologically impossible or a known sentinel) and should be hidden.
   Mirrors ZERO_NOT_MEANINGFUL in BreastfeedingRecommendationDocument.jsx. */
const ZERO_NOT_MEANINGFUL = new Set(['maternalAge', 'gestationalAgeAtDelivery', 'infantBirthWeight', 'bilirubinLevel']);
const isSuppressedZero = (fn, v) => typeof v === 'number' && v === 0 && ZERO_NOT_MEANINGFUL.has(fn);

/* renderFieldRow: label + value inside fieldBox. fieldName lets us suppress not-measured zeros. */
const renderFieldRow = (label, value, fieldName) => {
  if (!hasVal(value) || isSuppressedZero(fieldName, value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* Fix 2 & 5: renderSentenceField with sequential counterRef */
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

  /* Fix 4: Proper wrap strategy */
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

/* renderArrayField */
const renderArrayField = (label, items, counterRef) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const BreastfeedingRecommendationDocumentPDFTemplate = ({ document: data }) => {
  /* Handle data unwrapping */
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.breastfeeding_recommendation && Array.isArray(data.breastfeeding_recommendation)) {
    records = data.breastfeeding_recommendation;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.breastfeeding_recommendation) {
      records = docData.breastfeeding_recommendation;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Breastfeeding Recommendation</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Breastfeeding Recommendation</Text></View>
        {records.map((record, idx) => {
          const ctr = { n: 1 };
          return (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Breastfeeding Recommendation ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* 1. Maternal Information */}
            {((hasVal(record.maternalAge) && !isSuppressedZero('maternalAge', record.maternalAge)) || (hasVal(record.gestationalAgeAtDelivery) && !isSuppressedZero('gestationalAgeAtDelivery', record.gestationalAgeAtDelivery)) || hasVal(record.deliveryMethod) || hasVal(record.maternalComorbidities) || hasVal(record.maternalMedications) || hasVal(record.maternalSubstanceUse) || hasVal(record.contraindications)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Maternal Information</Text>
                  {renderFieldRow('Maternal Age', record.maternalAge, 'maternalAge')}
                  {renderFieldRow('Gestational Age at Delivery', record.gestationalAgeAtDelivery, 'gestationalAgeAtDelivery')}
                </View>
                {renderSentenceField('Delivery Method', record.deliveryMethod, ctr)}
                {renderArrayField('Maternal Comorbidities', record.maternalComorbidities, ctr)}
                {renderArrayField('Maternal Medications', record.maternalMedications, ctr)}
                {renderArrayField('Maternal Substance Use', record.maternalSubstanceUse, ctr)}
                {renderArrayField('Contraindications', record.contraindications, ctr)}
              </View>
            )}

            {/* 2. Infant Information */}
            {((hasVal(record.infantBirthWeight) && !isSuppressedZero('infantBirthWeight', record.infantBirthWeight)) || hasVal(record.apgarScoreFiveMinute) || hasVal(record.infantMedicalConditions) || hasVal(record.jaundicePresent) || (hasVal(record.bilirubinLevel) && !isSuppressedZero('bilirubinLevel', record.bilirubinLevel)) || hasVal(record.weightLossPercentage)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Infant Information</Text>
                  {renderFieldRow('Infant Birth Weight (g)', record.infantBirthWeight, 'infantBirthWeight')}
                  {renderFieldRow('Apgar Score (5 min)', record.apgarScoreFiveMinute, 'apgarScoreFiveMinute')}
                  {renderFieldRow('Jaundice Present', record.jaundicePresent, 'jaundicePresent')}
                  {renderFieldRow('Bilirubin Level', record.bilirubinLevel, 'bilirubinLevel')}
                  {renderFieldRow('Weight Loss (%)', record.weightLossPercentage, 'weightLossPercentage')}
                </View>
                {renderArrayField('Infant Medical Conditions', record.infantMedicalConditions, ctr)}
              </View>
            )}

            {/* 3. Feeding Assessment */}
            {(hasVal(record.breastfeedingInitiation) || hasVal(record.milkProduction) || hasVal(record.nippleCondition) || hasVal(record.feedingFrequency) || hasVal(record.latchAssessmentScore) || hasVal(record.supplementationRequired)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Feeding Assessment</Text>
                </View>
                {renderSentenceField('Breastfeeding Initiation', record.breastfeedingInitiation, ctr)}
                {renderSentenceField('Milk Production', record.milkProduction, ctr)}
                {renderSentenceField('Nipple Condition', record.nippleCondition, ctr)}
                {renderSentenceField('Feeding Frequency (per day)', record.feedingFrequency, ctr)}
                {renderSentenceField('Latch Assessment Score', record.latchAssessmentScore, ctr)}
                {renderSentenceField('Supplementation Required', record.supplementationRequired, ctr)}
              </View>
            )}

            {/* 4. Goals & Plan */}
            {(hasVal(record.exclusiveBreastfeedingGoal) || hasVal(record.lactationConsultationIndicated) || hasVal(record.pumpingIndications) || hasVal(record.immunizationStatus)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Goals and Plan</Text>
                  {hasVal(record.exclusiveBreastfeedingGoal) && renderFieldRow('Exclusive Breastfeeding Goal', record.exclusiveBreastfeedingGoal)}
                  {hasVal(record.lactationConsultationIndicated) && renderFieldRow('Lactation Consultation Indicated', record.lactationConsultationIndicated)}
                </View>
                {renderSentenceField('Immunization Status', record.immunizationStatus, ctr)}
                {renderArrayField('Pumping Indications', record.pumpingIndications, ctr)}
              </View>
            )}
          </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default BreastfeedingRecommendationDocumentPDFTemplate;
