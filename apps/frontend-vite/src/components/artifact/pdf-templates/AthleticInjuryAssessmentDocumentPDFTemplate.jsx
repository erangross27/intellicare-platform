/**
 * AthleticInjuryAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — athletic injury assessment
 * Collection: athletic_injury_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 13, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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

/* stripTime: date / ISO datetime → date-only display (UTC, no timezone shift); non-date passes through. */
const stripTime = (val) => {
  const s = String(val == null ? '' : val);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/);
  if (!m) return s;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (isNaN(d.getTime())) return `${m[1]}-${m[2]}-${m[3]}`;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

/* Expand a labeled value "L: v1, L2: v2, ..." (value may embed more "Label: value" pairs separated
   by commas) into nested-subtitle + numbered item rows. First comma item pairs with `label`. */
const expandLabeledToRows = (label, value, counter, rows) => {
  const commaItems = splitByComma(value);
  if (commaItems.length >= 2) {
    commaItems.forEach((ci, ciIdx) => {
      const cp = ciIdx === 0 ? { isLabeled: true, label, value: ci } : parseLabel(ci);
      if (cp.isLabeled) {
        rows.push({ type: 'subtitle', text: safeString(cp.label) });
        rows.push({ type: 'item', text: safeString(cp.value), num: counter.n++ });
      } else {
        rows.push({ type: 'item', text: safeString(ci), num: counter.n++ });
      }
    });
  } else {
    rows.push({ type: 'subtitle', text: safeString(label) });
    rows.push({ type: 'item', text: safeString(value), num: counter.n++ });
  }
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
      <Text style={styles.fieldValue}>{stripTime(value)}</Text>
    </View>
  );
};

/* renderBooleanField */
const renderBooleanFieldPDF = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{value ? 'Yes' : 'No'}</Text>
    </View>
  );
};

/* renderSentenceSection: split into semicolon (2+) or sentence units; each labeled value is expanded
   (comma-aware) into nested-subtitle + numbered value rows — never raw / side-by-side "Label: value". */
const renderSentenceSection = (label, text, showLabel) => {
  if (!hasVal(text)) return null;
  const strVal = fmtVal(text);

  const scItems = splitBySemicolon(strVal);
  const units = scItems.length >= 2 ? scItems : splitBySentence(strVal);
  if (units.length === 0) return null;

  const rows = [];
  const counter = { n: 1 };
  units.forEach(u => {
    const parsed = parseLabel(u);
    if (parsed.isLabeled) {
      expandLabeledToRows(parsed.label, parsed.value, counter, rows);
    } else {
      rows.push({ type: 'item', text: safeString(u), num: counter.n++ });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
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
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Record Information',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'sportActivity', label: 'Sport / Activity', isSentence: true },
      { key: 'competitionLevel', label: 'Competition Level', isSentence: true },
    ],
  },
  {
    title: 'Injury Details',
    fields: [
      { key: 'injuryMechanism', label: 'Injury Mechanism', isSentence: true },
      { key: 'anatomicLocation', label: 'Anatomic Location', isSentence: true },
      { key: 'injuryClassification', label: 'Injury Classification', isSentence: true },
      { key: 'severityGrade', label: 'Severity Grade', isSentence: true },
      { key: 'timeOfInjury', label: 'Time of Injury', isDate: true },
    ],
  },
  {
    title: 'Immediate Response',
    fields: [
      { key: 'immediateSymptoms', label: 'Immediate Symptoms', isArray: true },
      { key: 'abilityToContinuePlay', label: 'Ability to Continue Play', isBoolean: true },
      { key: 'sidelineInterventions', label: 'Sideline Interventions', isArray: true },
      { key: 'concussionScreenPerformed', label: 'Concussion Screen Performed', isBoolean: true },
    ],
  },
  {
    title: 'Physical Examination',
    fields: [
      { key: 'swellingPresent', label: 'Swelling Present', isBoolean: true },
      { key: 'ecchymosisPresent', label: 'Ecchymosis Present', isBoolean: true },
      { key: 'rangeOfMotionLimitations', label: 'Range of Motion Limitations', isSentence: true },
      { key: 'strengthDeficit', label: 'Strength Deficit', isSentence: true },
      { key: 'neurovascularStatus', label: 'Neurovascular Status', isSentence: true },
      { key: 'weightBearingStatus', label: 'Weight Bearing Status', isSentence: true },
    ],
  },
  {
    title: 'Special Tests',
    fields: [
      { key: 'specialTestsPerformed', label: 'Special Tests Performed', isArray: true },
      { key: 'specialTestsPositive', label: 'Special Tests Positive', isArray: true },
    ],
  },
  {
    title: 'Imaging & Rehabilitation',
    fields: [
      { key: 'imagingOrdered', label: 'Imaging Ordered', isArray: true },
      { key: 'rehabilitationPhase', label: 'Rehabilitation Phase', isSentence: true },
      { key: 'functionalLimitations', label: 'Functional Limitations', isArray: true },
      { key: 'priorInjurySameSite', label: 'Prior Injury Same Site', isBoolean: true },
    ],
  },
  {
    title: 'Return to Play',
    fields: [
      { key: 'returnToPlayCriteria', label: 'Return to Play Criteria', isArray: true },
      { key: 'estimatedRecoveryTime', label: 'Estimated Recovery Time', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const AthleticInjuryAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.athletic_injury_assessment) return Array.isArray(r.athletic_injury_assessment) ? r.athletic_injury_assessment : [r.athletic_injury_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.athletic_injury_assessment) return Array.isArray(dd.athletic_injury_assessment) ? dd.athletic_injury_assessment : [dd.athletic_injury_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Athletic Injury Assessment</Text>
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
          <Text style={styles.documentTitle}>Athletic Injury Assessment</Text>
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
                {`Athletic Injury Assessment ${index + 1}`}
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
                if (field.isBoolean) return renderBooleanFieldPDF(field.label, val, showLabel);
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

export default AthleticInjuryAssessmentDocumentPDFTemplate;
