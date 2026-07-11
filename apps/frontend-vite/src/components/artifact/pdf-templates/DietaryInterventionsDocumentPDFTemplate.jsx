/**
 * DietaryInterventionsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dietary_interventions.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first field. Every value row numbered
 * ("1." even singles). break={idx>0} → one record per page. Mirrors the JSX exactly — sentinel-zero
 * numerics hidden (every dietary numeric 0 = "not set"; a negative weightChangeGoal = weight-loss
 * still shows), empty sections drop out. Record title = "Dietary Interventions N".
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 6 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldGroup: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS (mirror the JSX) ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
/* every dietary numeric 0 is a "not set" sentinel → hidden; a non-zero (incl. negative) shows. */
const numShows = (v) => (typeof v === 'number' ? v !== 0 : hasVal(v));

const DietaryInterventionsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dietary_interventions) return Array.isArray(r.dietary_interventions) ? r.dietary_interventions : [r.dietary_interventions];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dietary_interventions) return Array.isArray(dd.dietary_interventions) ? dd.dietary_interventions : [dd.dietary_interventions]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Dietary Interventions">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dietary Interventions</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  const sectionTitle = (t) => <Text style={styles.sectionTitle}>{t}</Text>;

  /* One field group: (title) + sub-label + 0.5pt rule + numbered value rows. wrap is boolean. */
  const fieldGroup = (label, values, key, withTitle) => {
    if (!values || values.length === 0) return null;
    return (
      <View key={key} style={styles.fieldGroup} wrap={values.length > 8}>
        {withTitle}
        {label ? <Text style={styles.fieldLabel}>{safeString(label)}</Text> : null}
        {values.map((v, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(v)}`}</Text>)}
      </View>
    );
  };

  /* Render a section from a list of {label, values[]} groups; sectionTitle rides inside the first. */
  const renderGroups = (title, groups, keyPrefix) => groups.length === 0 ? null : (
    <View style={styles.section}>
      {groups.map((g, i) => fieldGroup(g.label, g.values, `${keyPrefix}-${i}`, i === 0 ? sectionTitle(title) : null))}
    </View>
  );

  const renderRecord = (record, idx) => {
    const numG = (label, fn) => numShows(record[fn]) ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const strG = (label, fn) => hasVal(record[fn]) ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const boolG = (label, fn) => (record[fn] !== null && record[fn] !== undefined && record[fn] !== '') ? { label, values: [fmtVal(record[fn])] } : null;
    const arrG = (label, fn) => { const a = (Array.isArray(record[fn]) ? record[fn] : []).filter(hasVal).map(x => safeString(fmtVal(x))); return a.length ? { label, values: a } : null; };

    const nutrition = [numG('Nutritional Assessment Score', 'nutritionalAssessmentScore'), numG('Baseline BMI', 'baselineBodyMassIndex'), numG('Target Caloric Intake', 'targetCaloricIntake'), numG('Protein Requirement', 'proteinRequirement')].filter(Boolean);
    const dietType = [strG('Therapeutic Diet Type', 'therapeuticDietType'), arrG('Dietary Restrictions', 'dietaryRestrictions'), numG('Sodium Restriction Level', 'sodiumRestrictionLevel'), numG('Fluid Restriction Volume', 'fluidRestrictionVolume')].filter(Boolean);
    const glycemic = [strG('Glycemic Target Range', 'glycemicTargetRange'), boolG('Carbohydrate Counting Prescribed', 'carbohydrateCountingPrescribed')].filter(Boolean);
    const supplementation = [arrG('Nutritional Supplementation', 'nutritionalSupplementation'), strG('Enteral Nutrition Formula', 'enteralNutritionFormula'), strG('Parenteral Nutrition Composition', 'parenteralNutritionComposition')].filter(Boolean);
    const deficiencies = [arrG('Micronutrient Deficiencies', 'micronutrientDeficiencies'), arrG('Food Allergen Avoidance', 'foodAllergenAvoidance')].filter(Boolean);
    const dysphagia = [strG('Dysphagia Texture Level', 'dysphagiaTextureLevel')].filter(Boolean);
    const goals = [numG('Weight Change Goal', 'weightChangeGoal'), numG('Intervention Duration (Weeks)', 'interventionDurationWeeks'), strG('Adherence Monitoring Method', 'adherenceMonitoringMethod')].filter(Boolean);
    const labs = [numG('Baseline Albumin Level', 'baselineAlbuminLevel'), numG('Baseline Prealbumin Level', 'baselinePrealbuminLevel'), numG('eGFR', 'estimatedGlomerularFiltrationRate'), numG('LVEF', 'leftVentricularEjectionFraction')].filter(Boolean);
    const malnutrition = [numG('Malnutrition Risk Score', 'malnutritionRiskScore')].filter(Boolean);

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Dietary Interventions ${idx + 1}`}</Text>
        </View>

        {renderGroups('Nutritional Assessment', nutrition, 'na')}
        {renderGroups('Diet Type & Restrictions', dietType, 'dt')}
        {renderGroups('Glycemic Management', glycemic, 'gm')}
        {renderGroups('Supplementation', supplementation, 'su')}
        {renderGroups('Deficiencies & Allergies', deficiencies, 'de')}
        {renderGroups('Dysphagia', dysphagia, 'dy')}
        {renderGroups('Goals', goals, 'go')}
        {renderGroups('Labs', labs, 'la')}
        {renderGroups('Malnutrition Risk', malnutrition, 'mr')}
      </View>
    );
  };

  return (
    <Document title="Dietary Interventions">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dietary Interventions</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DietaryInterventionsDocumentPDFTemplate;
