/**
 * SportsNutritionPlanDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — sports nutrition plan
 * Collection: sports_nutrition_plan
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 52, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  sourceText: { opacity: 0, fontSize: 0, height: 0 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
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

const pdfSafe = (value) => safeString(value).replace(/≥/g, '>=').replace(/≤/g, '<=');

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split, with splitBySemicolon pre-split */
const renderSentenceSection = (label, text, showLabel) => {
  if (!hasVal(text)) return null;
  const strVal = fmtVal(text);

  /* splitBySemicolon pre-split before comma split */
  const scItems = splitBySemicolon(strVal);
  if (scItems.length >= 2) {
    const wrapProp = scItems.length > 8 ? true : false;
    return (
      <View style={styles.fieldBox} wrap={wrapProp}>
        {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        {scItems.map((item, i) => {
          const parsed = parseLabel(item);
          if (parsed.isLabeled) {
            return (
              <React.Fragment key={i}>
                <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>
                <Text style={styles.listItem}>{i + 1}. {safeString(parsed.value)}</Text>
              </React.Fragment>
            );
          }
          return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>;
        })}
      </View>
    );
  }

  const sentences = splitBySentence(strVal);
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

  const wrapProp = rows.length > 8 ? true : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
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
const renderArrayFieldPDF = (label, items, showLabel) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? true : false}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => {
        const source = safeString(item);
        return (
          <React.Fragment key={i}>
            <Text style={styles.listItem}>{i + 1}. {pdfSafe(source)}</Text>
            {/[≥≤]/.test(source) && <Text style={styles.sourceText}>{source}</Text>}
          </React.Fragment>
        );
      })}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Record Information',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'prescribingDietitian', label: 'Prescribing Dietitian', isSentence: true },
      { key: 'athleteSportDiscipline', label: 'Athlete Sport / Discipline', isSentence: true },
      { key: 'competitionLevel', label: 'Competition Level', isSentence: true },
    ],
  },
  {
    title: 'Training Goals',
    fields: [
      { key: 'trainingPhase', label: 'Training Phase', isSentence: true },
      { key: 'bodyCompositionGoal', label: 'Body Composition Goal', isSentence: true },
    ],
  },
  {
    title: 'Body Composition',
    fields: [
      { key: 'currentBodyWeight', label: 'Current Body Weight' },
      { key: 'targetBodyWeight', label: 'Target Body Weight' },
      { key: 'bodyFatPercentage', label: 'Body Fat Percentage' },
      { key: 'leanBodyMass', label: 'Lean Body Mass' },
      { key: 'basalMetabolicRate', label: 'Basal Metabolic Rate' },
      { key: 'totalDailyEnergyExpenditure', label: 'Total Daily Energy Expenditure' },
    ],
  },
  {
    title: 'Macronutrients',
    fields: [
      { key: 'dailyCaloricTarget', label: 'Daily Caloric Target' },
      { key: 'macronutrientProteinGrams', label: 'Protein (g)' },
      { key: 'macronutrientCarbohydrateGrams', label: 'Carbohydrate (g)' },
      { key: 'macronutrientFatGrams', label: 'Fat (g)' },
    ],
  },
  {
    title: 'Hydration',
    fields: [
      { key: 'hydrationTargetLiters', label: 'Hydration Target (L)' },
      { key: 'sweatRateMillilitersPerHour', label: 'Sweat Rate (mL/hr)' },
      { key: 'mealFrequencyPerDay', label: 'Meal Frequency Per Day' },
      { key: 'nutritionPlanDurationWeeks', label: 'Nutrition Plan Duration (weeks)' },
    ],
  },
  {
    title: 'Nutrition Timing',
    fields: [
      { key: 'preWorkoutNutritionProtocol', label: 'Pre-Workout Nutrition Protocol', isSentence: true },
      { key: 'intraWorkoutNutritionProtocol', label: 'Intra-Workout Nutrition Protocol', isSentence: true },
      { key: 'postWorkoutNutritionProtocol', label: 'Post-Workout Nutrition Protocol', isSentence: true },
    ],
  },
  {
    title: 'Supplements',
    fields: [
      { key: 'supplementationRegimen', label: 'Supplementation Regimen', isArray: true },
    ],
  },
  {
    title: 'Restrictions',
    fields: [
      { key: 'dietaryRestrictions', label: 'Dietary Restrictions', isArray: true },
      { key: 'foodAllergies', label: 'Food Allergies', isArray: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const SportsNutritionPlanDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.sports_nutrition_plan) return Array.isArray(r.sports_nutrition_plan) ? r.sports_nutrition_plan : [r.sports_nutrition_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.sports_nutrition_plan) return Array.isArray(dd.sports_nutrition_plan) ? dd.sports_nutrition_plan : [dd.sports_nutrition_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sports Nutrition Plan</Text>
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
        <View style={styles.documentHeader} wrap={false}>
          <Text style={styles.documentTitle}>Sports Nutrition Plan</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {`Sports Nutrition Plan ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => hasVal(record[f.key]));
              if (presentFields.length === 0) return null;

              const renderField = (field) => {
                const val = record[field.key];
                const showLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                if (field.isDate) return renderDateFieldPDF(field.label, val, showLabel);
                if (field.isArray) return renderArrayFieldPDF(field.label, val, showLabel);
                if (field.isSentence) return renderSentenceSection(field.label, val, showLabel);
                return renderFieldRow(field.label, val, showLabel);
              };

              return (
                <View key={sIdx} style={styles.section}>
                  {/* Title + first field together — prevents orphaned titles */}
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderField(presentFields[0])}
                  </View>
                  {/* Remaining fields */}
                  {presentFields.slice(1).map((field, fIdx) => (
                    <View key={fIdx}>{renderField(field)}</View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SportsNutritionPlanDocumentPDFTemplate;
