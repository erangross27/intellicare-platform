/**
 * RehabilitationProgressNotesDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — rehabilitation progress notes
 * Collection: rehabilitation_progress_notes
 * Black/white only — NO #606060
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

/* ======= SECTION TITLES (for showLabel) ======= */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'assessment-scores': 'Assessment Scores',
  'mobility-testing': 'Mobility Testing',
  'muscle-rom': 'Muscle & Range of Motion',
  'therapy-progress': 'Therapy Progress',
  'goals-interventions': 'Goals & Interventions',
  'devices-comorbidities': 'Devices & Comorbidities',
  'discharge': 'Discharge',
};

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

/* renderSentenceField: parseLabel + semicolon-pre-split + comma-split, with optional sectionTitle inside fieldBox */
const renderSentenceField = (label, text, sectionTitle, showLabel = true) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const semiItems = splitBySemicolon(parsed.value);
      const commaItems = semiItems.length >= 2 ? semiItems : splitByComma(parsed.value);
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
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderArrayFieldPDF */
const renderArrayFieldPDF = (label, items, sectionTitle, showLabel = true) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    id: 'record-info',
    title: 'Record Information',
    fields: [
      { key: 'createdAt', label: 'Record Information', isDate: true },
    ],
  },
  {
    id: 'assessment-scores',
    title: 'Assessment Scores',
    fields: [
      { key: 'functionalIndependenceMeasure', label: 'Functional Independence Measure' },
      { key: 'barthel', label: 'Barthel' },
      { key: 'rankinScale', label: 'Rankin Scale' },
      { key: 'cognitiveAssessment', label: 'Cognitive Assessment' },
      { key: 'berghBalance', label: 'Bergh Balance' },
      { key: 'painScale', label: 'Pain Scale' },
    ],
  },
  {
    id: 'mobility-testing',
    title: 'Mobility Testing',
    fields: [
      { key: 'gaitSpeed', label: 'Gait Speed' },
      { key: 'sixMinuteWalkTest', label: 'Six Minute Walk Test' },
      { key: 'timedUpAndGo', label: 'Timed Up And Go' },
      { key: 'functionalReach', label: 'Functional Reach' },
      { key: 'ashworthScale', label: 'Ashworth Scale', isSentence: true },
    ],
  },
  {
    id: 'muscle-rom',
    title: 'Muscle & Range of Motion',
    fields: [
      { key: 'rangeOfMotion', label: 'Range Of Motion', isArray: true },
      { key: 'muscleStrengthTesting', label: 'Muscle Strength Testing', isArray: true },
    ],
  },
  {
    id: 'therapy-progress',
    title: 'Therapy Progress',
    fields: [
      { key: 'swallowingAssessment', label: 'Swallowing Assessment', isSentence: true },
      { key: 'speechTherapyProgress', label: 'Speech Therapy Progress', isSentence: true },
      { key: 'therapyParticipation', label: 'Therapy Participation', isSentence: true },
    ],
  },
  {
    id: 'goals-interventions',
    title: 'Goals & Interventions',
    fields: [
      { key: 'occupationalTherapyGoals', label: 'Occupational Therapy Goals', isArray: true },
      { key: 'physicalTherapyInterventions', label: 'Physical Therapy Interventions', isArray: true },
    ],
  },
  {
    id: 'devices-comorbidities',
    title: 'Devices & Comorbidities',
    fields: [
      { key: 'assistiveDevices', label: 'Assistive Devices', isArray: true },
      { key: 'comorbidityImpact', label: 'Comorbidity Impact', isArray: true },
    ],
  },
  {
    id: 'discharge',
    title: 'Discharge',
    fields: [
      { key: 'dischargeDisposition', label: 'Discharge Disposition', isSentence: true },
      { key: 'rehabilitationPotential', label: 'Rehabilitation Potential', isSentence: true },
      { key: 'medicationCompliance', label: 'Medication Compliance', isBoolean: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const RehabilitationProgressNotesDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.rehabilitation_progress_notes) return Array.isArray(r.rehabilitation_progress_notes) ? r.rehabilitation_progress_notes : [r.rehabilitation_progress_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.rehabilitation_progress_notes) return Array.isArray(dd.rehabilitation_progress_notes) ? dd.rehabilitation_progress_notes : [dd.rehabilitation_progress_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Rehabilitation Progress Notes</Text>
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
          <Text style={styles.documentTitle}>Rehabilitation Progress Notes</Text>
        </View>

        {records.map((record, index) => (
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
                {`Rehabilitation Progress Notes ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const activeFields = sectionConfig.fields.filter(f => hasVal(record[f.key]));
              if (activeFields.length === 0) return null;

              let isFirstField = true;

              return (
                <View key={sIdx} style={styles.section} break={sectionConfig.fields.reduce((sum, f) => {
                  const v = record[f.key];
                  if (Array.isArray(v)) return sum + v.length;
                  if (typeof v === 'string') { const s = splitBySentence(v); return sum + (s.length > 1 ? s.length : 1); }
                  return sum + 1;
                }, 0) >= 15 ? true : undefined}>
                  {activeFields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;

                    const sectionTitleForField = isFirstField ? sectionConfig.title : null;
                    const showLabel = field.label.toLowerCase() !== (SECTION_TITLES[sectionConfig.id] || '').toLowerCase();

                    if (field.isDate) {
                      isFirstField = false;
                      return (
                        <View key={fIdx} style={styles.fieldBox} wrap={false}>
                          {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                          {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
                          <Text style={styles.fieldValue}>{formatDate(val)}</Text>
                        </View>
                      );
                    }
                    if (field.isArray) {
                      isFirstField = false;
                      return <View key={fIdx}>{renderArrayFieldPDF(field.label, val, sectionTitleForField, showLabel)}</View>;
                    }
                    if (field.isBoolean) {
                      isFirstField = false;
                      return (
                        <View key={fIdx} style={styles.fieldBox} wrap={false}>
                          {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                          {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
                          <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
                        </View>
                      );
                    }
                    if (field.isSentence) {
                      const result = renderSentenceField(showLabel ? field.label : '', fmtVal(val), sectionTitleForField, showLabel);
                      if (result) isFirstField = false;
                      return <View key={fIdx}>{result}</View>;
                    }
                    /* Default: number */
                    isFirstField = false;
                    return (
                      <View key={fIdx} style={styles.fieldBox} wrap={false}>
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
        ))}
      </Page>
    </Document>
  );
};

export default RehabilitationProgressNotesDocumentPDFTemplate;
