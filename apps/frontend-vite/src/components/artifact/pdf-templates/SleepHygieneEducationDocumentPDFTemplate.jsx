/**
 * SleepHygieneEducationDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — sleep hygiene education
 * Collection: sleep_hygiene_education
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

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s+/).map(s => s.trim()).filter(s => s.length > 0);
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

const SEMICOLON_FIELDS = ['bedroomEnvironment'];

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

/* renderSentenceField: parseLabel + comma-split, with optional sectionTitle inside fieldBox */
const renderSentenceField = (label, text, sectionTitle, fieldName) => {
  if (!hasVal(text)) return null;
  const isSemicolon = SEMICOLON_FIELDS.includes(fieldName);
  const sentences = isSemicolon ? splitBySemicolon(fmtVal(text)) : splitBySentence(fmtVal(text));
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
      /* Unlabeled with 2+ comma items: split into rows */
      const commaItems = splitByComma(s);
      if (commaItems.length >= 2) {
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    }
  });

  const wrapProp = sectionTitle ? false : (rows.length > 8 ? undefined : false);

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
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'sleep-metrics': 'Sleep Metrics',
  'sleep-schedule': 'Sleep Schedule',
  'lifestyle-factors': 'Lifestyle Factors',
  'sleep-environment': 'Sleep Environment',
  'education-interventions': 'Education & Interventions',
  'techniques-materials': 'Techniques & Materials',
  'follow-up': 'Follow-Up',
};

const SECTION_CONFIGS = [
  {
    id: 'record-info',
    title: 'Record Information',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'primarySleepComplaint', label: 'Primary Sleep Complaint', isSentence: true },
      { key: 'epworthSleepinessScore', label: 'Epworth Sleepiness Score' },
    ],
  },
  {
    id: 'sleep-metrics',
    title: 'Sleep Metrics',
    fields: [
      { key: 'averageSleepLatency', label: 'Average Sleep Latency' },
      { key: 'totalSleepTime', label: 'Total Sleep Time' },
      { key: 'nighttimeAwakenings', label: 'Nighttime Awakenings' },
      { key: 'screenTimeBeforeBed', label: 'Screen Time Before Bed' },
    ],
  },
  {
    id: 'sleep-schedule',
    title: 'Sleep Schedule',
    fields: [
      { key: 'regularBedtime', label: 'Regular Bedtime', isSentence: true },
      { key: 'regularWakeTime', label: 'Regular Wake Time', isSentence: true },
      { key: 'weekendSleepSchedule', label: 'Weekend Sleep Schedule', isSentence: true },
      { key: 'bedtimeRoutine', label: 'Bedtime Routine', isSentence: true },
    ],
  },
  {
    id: 'lifestyle-factors',
    title: 'Lifestyle Factors',
    fields: [
      { key: 'caffeineIntake', label: 'Caffeine Intake', isSentence: true },
      { key: 'alcoholConsumption', label: 'Alcohol Consumption', isSentence: true },
      { key: 'nicotineUse', label: 'Nicotine Use', isBoolean: true },
      { key: 'exerciseHabits', label: 'Exercise Habits', isSentence: true },
      { key: 'dinnertimeHabits', label: 'Dinnertime Habits', isSentence: true },
      { key: 'nappingFrequency', label: 'Napping Frequency', isSentence: true },
    ],
  },
  {
    id: 'sleep-environment',
    title: 'Sleep Environment',
    fields: [
      { key: 'bedroomEnvironment', label: 'Bedroom Environment', isSentence: true },
    ],
  },
  {
    id: 'education-interventions',
    title: 'Education & Interventions',
    fields: [
      { key: 'educationTopicsCovered', label: 'Education Topics Covered', isArray: true },
      { key: 'behavioralInterventions', label: 'Behavioral Interventions', isArray: true },
      { key: 'stimulusControlInstructions', label: 'Stimulus Control Instructions', isBoolean: true },
      { key: 'sleepRestrictionTherapy', label: 'Sleep Restriction Therapy', isBoolean: true },
    ],
  },
  {
    id: 'techniques-materials',
    title: 'Techniques & Materials',
    fields: [
      { key: 'relaxationTechniques', label: 'Relaxation Techniques', isArray: true },
      { key: 'educationalMaterials', label: 'Educational Materials', isArray: true },
    ],
  },
  {
    id: 'follow-up',
    title: 'Follow-Up',
    fields: [
      { key: 'followUpInterval', label: 'Follow-Up Interval', isSentence: true },
      { key: 'sleepDiaryRequested', label: 'Sleep Diary Requested', isBoolean: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const SleepHygieneEducationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.sleep_hygiene_education) return Array.isArray(r.sleep_hygiene_education) ? r.sleep_hygiene_education : [r.sleep_hygiene_education];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.sleep_hygiene_education) return Array.isArray(dd.sleep_hygiene_education) ? dd.sleep_hygiene_education : [dd.sleep_hygiene_education]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Sleep Hygiene Education</Text>
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
          <Text style={styles.documentTitle}>Sleep Hygiene Education</Text>
        </View>

        {records.map((record, index) => {
          let counter = 1;
          return (
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
                  {`Sleep Hygiene Education ${index + 1}`}
                </Text>
              </View>

              {/* Sections */}
              {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
                const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
                if (!hasAnyVal) return null;

                let isFirstField = true;

                return (
                  <View key={sIdx} style={styles.section} break={sectionConfig.fields.reduce((sum, f) => {
                    const val = record[f.key];
                    if (f.isArray && Array.isArray(val)) return sum + val.length;
                    if (hasVal(val)) return sum + 1;
                    return sum;
                  }, 0) >= 15}>
                    {sectionConfig.fields.map((field, fIdx) => {
                      const val = record[field.key];
                      if (!hasVal(val)) return null;

                      const sectionTitleForField = isFirstField ? sectionConfig.title : null;
                      const showLabel = field.label.toLowerCase() !== (SECTION_TITLES[sectionConfig.id] || '').toLowerCase();

                      if (field.isDate) {
                        isFirstField = false;
                        return (
                          <View key={fIdx} style={styles.fieldBox} wrap={sectionTitleForField ? false : undefined}>
                            {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                            {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
                            <Text style={styles.fieldValue}>{formatDate(val)}</Text>
                          </View>
                        );
                      }
                      if (field.isArray) {
                        isFirstField = false;
                        const safeItems = Array.isArray(val) ? val.filter(Boolean) : [];
                        if (safeItems.length === 0) return null;
                        return (
                          <View key={fIdx} style={styles.fieldBox} wrap={sectionTitleForField ? false : (safeItems.length > 8 ? undefined : false)}>
                            {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                            {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
                            {safeItems.map((item, i) => (
                              <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                            ))}
                          </View>
                        );
                      }
                      if (field.isBoolean) {
                        isFirstField = false;
                        return (
                          <View key={fIdx} style={styles.fieldBox} wrap={sectionTitleForField ? false : undefined}>
                            {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                            {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
                            <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
                          </View>
                        );
                      }
                      if (field.isSentence) {
                        const result = renderSentenceField(showLabel ? field.label : '', fmtVal(val), sectionTitleForField, field.key);
                        if (result) isFirstField = false;
                        return <View key={fIdx}>{result}</View>;
                      }
                      /* Default: number */
                      isFirstField = false;
                      return (
                        <View key={fIdx} style={styles.fieldBox} wrap={sectionTitleForField ? false : undefined}>
                          {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                          {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
                          <Text style={styles.fieldValue}>{safeString(fmtVal(val))}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default SleepHygieneEducationDocumentPDFTemplate;
