/**
 * LifestyleRiskAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) - mirrors the JSX: real record.date (never
 * createdAt/updatedAt), scalar metrics numbered ('1.' even singles), 0-valued numeric metrics
 * hidden (hide-zero, matches the JSX), narratives split on [.;] with abbrev/single-initial guard,
 * labeled sentences comma-split into a subtitle group, single-name label gate. Rule #74: each field
 * is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's View.
 * safeString uses ONLY \uXXXX escapes (no literal smart-quotes/em-dashes/BOM). Static PHI footer.
 * Collection: lifestyle_risk_assessment.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['session-info', 'tobacco', 'alcohol', 'physical-activity', 'body-metrics', 'diet', 'sleep-stress', 'risk-scores'];
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'tobacco': 'Tobacco',
  'alcohol': 'Alcohol',
  'physical-activity': 'Physical Activity',
  'body-metrics': 'Body Metrics',
  'diet': 'Diet',
  'sleep-stress': 'Sleep & Stress',
  'risk-scores': 'Risk Scores',
};
const FIELD_LABELS = {
  date: 'Date',
  smokingStatus: 'Smoking Status',
  cigarettesPerDay: 'Cigarettes Per Day',
  smokingPackYears: 'Smoking Pack Years',
  alcoholConsumptionFrequency: 'Alcohol Consumption Frequency',
  alcoholDrinksPerWeek: 'Alcohol Drinks Per Week',
  bingeeDrinkingFrequency: 'Binge Drinking Frequency',
  physicalActivityLevel: 'Physical Activity Level',
  moderateExerciseMinutesPerWeek: 'Moderate Exercise (min/week)',
  vigorousExerciseMinutesPerWeek: 'Vigorous Exercise (min/week)',
  strengthTrainingDaysPerWeek: 'Strength Training (days/week)',
  sedentaryHoursPerDay: 'Sedentary Hours Per Day',
  occupationalPhysicalDemand: 'Occupational Physical Demand',
  screenTimeHoursPerDay: 'Screen Time (hours/day)',
  bodyMassIndex: 'Body Mass Index (BMI)',
  waistCircumference: 'Waist Circumference (cm)',
  dietaryPattern: 'Dietary Pattern',
  dailyFruitServings: 'Daily Fruit Servings',
  dailyVegetableServings: 'Daily Vegetable Servings',
  processedFoodFrequency: 'Processed Food Frequency',
  sleepHoursPerNight: 'Sleep Hours Per Night',
  sleepQualityRating: 'Sleep Quality Rating',
  stressLevel: 'Stress Level',
  substanceUseHistory: 'Substance Use History',
  cardiovascularRiskScore: 'Cardiovascular Risk Score',
  diabetesRiskScore: 'Diabetes Risk Score',
};
const SECTION_FIELDS = {
  'session-info': ['date'],
  'tobacco': ['smokingStatus', 'cigarettesPerDay', 'smokingPackYears'],
  'alcohol': ['alcoholConsumptionFrequency', 'alcoholDrinksPerWeek', 'bingeeDrinkingFrequency'],
  'physical-activity': ['physicalActivityLevel', 'moderateExerciseMinutesPerWeek', 'vigorousExerciseMinutesPerWeek', 'strengthTrainingDaysPerWeek', 'sedentaryHoursPerDay', 'occupationalPhysicalDemand', 'screenTimeHoursPerDay'],
  'body-metrics': ['bodyMassIndex', 'waistCircumference'],
  'diet': ['dietaryPattern', 'dailyFruitServings', 'dailyVegetableServings', 'processedFoodFrequency'],
  'sleep-stress': ['sleepHoursPerNight', 'sleepQualityRating', 'stressLevel', 'substanceUseHistory'],
  'risk-scores': ['cardiovascularRiskScore', 'diabetesRiskScore'],
};
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = [
  'cigarettesPerDay', 'smokingPackYears', 'alcoholDrinksPerWeek',
  'moderateExerciseMinutesPerWeek', 'vigorousExerciseMinutesPerWeek', 'strengthTrainingDaysPerWeek',
  'sedentaryHoursPerDay', 'screenTimeHoursPerDay', 'bodyMassIndex', 'waistCircumference',
  'dailyFruitServings', 'dailyVegetableServings', 'sleepHoursPerNight',
  'cardiovascularRiskScore', 'diabetesRiskScore',
];
const ARRAY_FIELDS = ['substanceUseHistory'];

const getVal = (obj, path) => { if (!obj || !path) return undefined; return String(path).split('.').reduce((cur, part) => (cur === null || cur === undefined) ? undefined : cur[part], obj); };

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);

/* safeString: normalize typographic glyphs to ASCII. \uXXXX escapes ONLY (no literal smart-quotes/
   em-dashes/BOM in the source - those trigger "Unterminated regular expression" and fail the audit). */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const sentenceRows = (text) => {
  const strip = (x) => String(x).replace(/[;.]+$/, '').trim();
  const rows = []; let n = 1;
  splitBySentence(text).forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        let m = 1;
        parts.forEach(it => {
          const ip = parseLabel(it);
          if (ip.isLabeled) rows.push({ type: 'subtitle', text: safeString(ip.label) });
          rows.push({ type: 'item', text: safeString(strip(ip.isLabeled ? ip.value : it)), num: m++ });
        });
      } else {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        rows.push({ type: 'item', text: safeString(strip(parsed.value)), num: 1 });
      }
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

/* hide-zero: a numeric metric of 0 is treated as "not recorded" and skipped (matches the JSX). */
const visible = (record, f) => {
  const v = getVal(record, f);
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(x => hasVal(x)).length > 0;
  if (!hasVal(v)) return false;
  if (NUMBER_FIELDS.includes(f) && Number(v) === 0) return false;
  return true;
};

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = getVal(record, f);
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : []).filter(x => hasVal(x));
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>)}
      </View>
    )];
  }

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {formatDate(val)}</Text>;
  } else if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(String(val))}</Text>;
  } else {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const LifestyleRiskAssessmentDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].lifestyle_risk_assessment && Array.isArray(templateData[0].lifestyle_risk_assessment)) records = templateData[0].lifestyle_risk_assessment;
    else records = templateData;
  } else if (templateData && templateData.lifestyle_risk_assessment) {
    records = Array.isArray(templateData.lifestyle_risk_assessment) ? templateData.lifestyle_risk_assessment : [templateData.lifestyle_risk_assessment];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.lifestyle_risk_assessment ? (Array.isArray(dd.lifestyle_risk_assessment) ? dd.lifestyle_risk_assessment : [dd.lifestyle_risk_assessment]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Lifestyle Risk Assessment</Text></View>
        <Text style={styles.emptyState}>No lifestyle risk assessment records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Lifestyle Risk Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Lifestyle Risk Assessment ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => visible(record, f));
              if (vis.length === 0) return null;
              return (
                <View key={sid} style={styles.section}>
                  {vis.flatMap((f, fi) => renderField(record, f, SECTION_TITLES[sid], fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default LifestyleRiskAssessmentDocumentPDFTemplate;
