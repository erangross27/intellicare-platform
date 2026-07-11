/**
 * DaytimeSleepinessAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — daytime sleepiness assessment
 * Collection: daytime_sleepiness_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4, textTransform: 'uppercase' },
  recordContainer: { marginBottom: 0, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 12, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', paddingBottom: 2 },
  fieldBox: { marginBottom: 6, paddingBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', paddingBottom: 1 },
  separator: { marginTop: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#666666', textAlign: 'center', marginTop: 40 },
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

/* render helpers for PDF (4-AREA mirror of JSX copy + bigger fonts + anti-orphan) */
const stripDelims = (t) => String(t || '').replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();

const renderSimpleRowPDF = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();
  return (
    <View style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{stripDelims(safeString(fmtVal(value)))}</Text>
    </View>
  );
};

const renderDateFieldPDF = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();
  return (
    <View style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') return renderSimpleRowPDF(label, text, sectionTitle);
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    const clean = stripDelims(parsed.isLabeled ? parsed.value : s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(clean);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: stripDelims(safeString(ci)), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: clean, num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: clean, num: n++ });
    }
  });

  const wrapProp = rows.length > 8 ? true : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
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

const renderArrayFieldPDF = (label, items, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  const wrapProp = safeItems.length > 8 ? true : false;
  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {stripDelims(safeString(item))}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'wakefulness-assessment': 'Wakefulness Assessment',
  'sleep-symptoms': 'Sleep Symptoms',
  'functional-impact': 'Functional Impact',
  'sleep-profile': 'Sleep Profile',
  'medications': 'Medications',
  'scores': 'Scores',
};

const FIELD_LABELS = {
  date: 'Date',
  epworthSleepinessScore: 'Epworth Sleepiness Score',
  averageSleepDuration: 'Average Sleep Duration',
  sleepLatency: 'Sleep Latency',
  maintenanceOfWakefulnessScore: 'Maintenance of Wakefulness Score',
  frequencyOfNodding: 'Frequency of Nodding',
  refreshedUponWaking: 'Refreshed Upon Waking',
  caffeineIntakeDaily: 'Caffeine Intake Daily',
  snoreFrequency: 'Snore Frequency',
  witnessedApneas: 'Witnessed Apneas',
  restlessnessAtNight: 'Restlessness at Night',
  cataplexyPresent: 'Cataplexy Present',
  sleepParalysisOccurrence: 'Sleep Paralysis Occurrence',
  hypnagogicHallucinations: 'Hypnagogic Hallucinations',
  drivingImpairment: 'Driving Impairment',
  occupationalImpact: 'Occupational Impact',
  nappingFrequency: 'Napping Frequency',
  chronotypeMorningEvening: 'Chronotype Morning/Evening',
  shiftWorkSchedule: 'Shift Work Schedule',
  sleepHygieneScore: 'Sleep Hygiene Score',
  stimulantMedicationUse: 'Stimulant Medication Use',
  sedativeMedicationUse: 'Sedative Medication Use',
  stopBangScore: 'STOP-BANG Score',
  functionalOutcomesOfSleepScore: 'Functional Outcomes of Sleep Score',
};

const SECTION_FIELDS = {
  'record-info': ['date', 'epworthSleepinessScore', 'averageSleepDuration', 'sleepLatency'],
  'wakefulness-assessment': ['maintenanceOfWakefulnessScore', 'frequencyOfNodding', 'refreshedUponWaking', 'caffeineIntakeDaily'],
  'sleep-symptoms': ['snoreFrequency', 'witnessedApneas', 'restlessnessAtNight', 'cataplexyPresent', 'sleepParalysisOccurrence', 'hypnagogicHallucinations'],
  'functional-impact': ['drivingImpairment', 'occupationalImpact', 'nappingFrequency'],
  'sleep-profile': ['chronotypeMorningEvening', 'shiftWorkSchedule', 'sleepHygieneScore'],
  'medications': ['stimulantMedicationUse', 'sedativeMedicationUse'],
  'scores': ['stopBangScore', 'functionalOutcomesOfSleepScore'],
};

const NUMBER_FIELDS = ['epworthSleepinessScore', 'averageSleepDuration', 'sleepLatency', 'maintenanceOfWakefulnessScore', 'caffeineIntakeDaily', 'sleepHygieneScore', 'stopBangScore', 'functionalOutcomesOfSleepScore'];
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['drivingImpairment', 'occupationalImpact', 'witnessedApneas', 'cataplexyPresent', 'sleepParalysisOccurrence', 'hypnagogicHallucinations', 'shiftWorkSchedule'];
const ARRAY_FIELDS = ['stimulantMedicationUse', 'sedativeMedicationUse'];
const STRING_FIELDS = ['frequencyOfNodding', 'snoreFrequency', 'restlessnessAtNight', 'chronotypeMorningEvening', 'nappingFrequency', 'refreshedUponWaking'];

/* ======= COMPONENT ======= */
const DaytimeSleepinessAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.daytime_sleepiness_assessment) return Array.isArray(r.daytime_sleepiness_assessment) ? r.daytime_sleepiness_assessment : [r.daytime_sleepiness_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.daytime_sleepiness_assessment) return Array.isArray(dd.daytime_sleepiness_assessment) ? dd.daytime_sleepiness_assessment : [dd.daytime_sleepiness_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Daytime Sleepiness Assessment</Text>
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
          <Text style={styles.documentTitle}>Daytime Sleepiness Assessment</Text>
        </View>

        {records.map((record, index) => {
          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header - keep small wrap false */}
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {record.date && (
                    <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>
                  {`Daytime Sleepiness Assessment ${index + 1}`}
                </Text>
              </View>

              {/* Sections (4-area): sectionTitle inside first content View; per-field wrap for anti-orphan; single-name + numbering consistent with copy */}
              {Object.entries(SECTION_FIELDS).map(([sid, fields]) => {
                const visibleFields = fields.filter(f => hasVal(record[f]) || (NUMBER_FIELDS.includes(f) && record[f] === 0));
                if (visibleFields.length === 0) return null;
                const sectionTitle = SECTION_TITLES[sid];

                return visibleFields.map((f, fi) => {
                  const val = record[f];
                  const label = FIELD_LABELS[f] || f;
                  const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
                  const isFirst = fi === 0;

                  let itemLen = 1;
                  if (ARRAY_FIELDS.includes(f) && Array.isArray(val)) itemLen = val.length;
                  else if (STRING_FIELDS.includes(f) && typeof val === 'string') itemLen = splitBySentence(val).length || 1;
                  const wrapVal = itemLen > 8 ? true : false;

                  const titleBlock = isFirst ? (
                    <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                  ) : null;

                  const content = DATE_FIELDS.includes(f) ? renderDateFieldPDF(label, val, sectionTitle)
                    : BOOLEAN_FIELDS.includes(f) || NUMBER_FIELDS.includes(f) ? renderSimpleRowPDF(label, val, sectionTitle)
                    : ARRAY_FIELDS.includes(f) ? renderArrayFieldPDF(label, val, sectionTitle)
                    : STRING_FIELDS.includes(f) ? renderSentenceField(label, fmtVal(val), sectionTitle)
                    : renderSimpleRowPDF(label, val, sectionTitle);

                  // Wrap title + first content together when first
                  if (isFirst) {
                    return (
                      <View key={`${sid}-${f}`} style={styles.fieldBox} wrap={wrapVal}>
                        {titleBlock}
                        {content}
                      </View>
                    );
                  }
                  return (
                    <React.Fragment key={`${sid}-${f}`}>
                      {content}
                    </React.Fragment>
                  );
                });
              })}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DaytimeSleepinessAssessmentDocumentPDFTemplate;
