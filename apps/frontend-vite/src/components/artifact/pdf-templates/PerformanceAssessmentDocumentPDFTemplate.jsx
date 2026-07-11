/**
 * PerformanceAssessmentDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — performance assessment
 * Collection: performance_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free B&W LETTER — underline RULES carry hierarchy (title 2pt black, section 1pt black,
   field label 0.5pt #999) instead of boxes/backgrounds. */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
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
  if (v instanceof Date) return !isNaN(v.getTime());
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  const s = String(v || '');
  return s.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/g, '$1 $2');
};

/* arrItemText: same array-item stringification as JSX (4-AREA RULE) */
const arrItemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' — ');
  return String(item);
};

/* objEntryTexts: same object-field stringification as JSX (4-AREA RULE) — "key: value" lines */
const objEntryTexts = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj instanceof Date) return [];
  return Object.entries(obj).map(([k, v]) => `${k}: ${fmtVal(v)}`);
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
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"-]{1,80}?):\s+([\s\S]*)/);
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

/* renderGroupedRows: render subtitle/item rows as groups so a subtitle (or the
   field label) can never be orphaned from its content rows at a page break.
   - group with <=6 content rows: whole group stays together (wrap={false})
   - group with >6 content rows: subtitle + first row kept together, rest follow */
const renderGroupedRows = (rows, label, showLabel) => {
  const groups = [];
  rows.forEach(row => {
    if (row.type === 'subtitle') {
      groups.push({ subtitle: row.text, items: [] });
    } else {
      if (groups.length === 0) groups.push({ subtitle: null, items: [] });
      groups[groups.length - 1].items.push(row);
    }
  });

  const itemRow = (row, key) => (
    <Text key={key} style={styles.listItem}>{row.num}. {row.text}</Text>
  );

  return groups.map((group, gi) => {
    const head = (
      <>
        {gi === 0 && showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        {group.subtitle !== null && <Text style={styles.nestedSubtitle}>{group.subtitle}</Text>}
      </>
    );
    if (group.items.length <= 6) {
      return (
        <View key={gi} wrap={false}>
          {head}
          {group.items.map((row, i) => itemRow(row, i))}
        </View>
      );
    }
    return (
      <View key={gi}>
        <View wrap={false}>
          {head}
          {itemRow(group.items[0], 'first')}
        </View>
        {group.items.slice(1).map((row, i) => itemRow(row, i))}
      </View>
    );
  });
};

/* renderFieldRow: label + value inside fieldBox (simple fields, booleans render Yes/No via fmtVal) — unconditional wrap={false} */
const renderFieldRow = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: period-first splitting with semicolon fallback */
const renderSentenceField = (label, text, showLabel) => {
  if (!hasVal(text)) return null;
  const strVal = fmtVal(text);

  const periodItems = splitBySentence(strVal);
  const isSemicolon = periodItems.length < 2;
  const sentences = isSemicolon ? splitBySemicolon(strVal) : periodItems;

  if (sentences.length < 2) {
    /* Single-value: try comma splitting */
    const commaItems = splitByComma(strVal);
    const hasOxfordComma = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
    if (commaItems.length >= 2 && !hasOxfordComma) {
      return (
        <View style={styles.fieldBox} wrap={commaItems.length > 8}>
          <View wrap={false}>
            {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
            <Text style={styles.listItem}>1. {safeString(commaItems[0])}</Text>
          </View>
          {commaItems.slice(1).map((ci, i) => (
            <Text key={i} style={styles.listItem}>{i + 2}. {safeString(ci)}</Text>
          ))}
        </View>
      );
    }
    return (
      <View style={styles.fieldBox} wrap={false}>
        {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{safeString(strVal)}</Text>
      </View>
    );
  }

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const semiSub = splitBySemicolon(parsed.value);
      const commaItems = semiSub.length >= 2 ? semiSub : splitByComma(parsed.value);
      const hasOxfordComma = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
      if (commaItems.length >= 2 && !hasOxfordComma) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  const wrapProp = rows.length > 8;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {renderGroupedRows(rows, label, showLabel)}
    </View>
  );
};

/* renderArrayField (array of strings or objects — items render VERBATIM, never split;
   isokinetic rows like "Quad Peak Torque 60°/sec: Left 168 Nm, Right 198 Nm, LSI 84.8%" stay intact) */
const renderArrayFieldPDF = (label, items, showLabel) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.map(arrItemText).filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      <View wrap={false}>
        {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.listItem}>1. {safeItems[0]}</Text>
      </View>
      {safeItems.slice(1).map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 2}. {item}</Text>
      ))}
    </View>
  );
};

/* renderObjectFieldPDF (object field — read-only "key: value" lines, same logic as JSX rows, 4-AREA RULE) */
const renderObjectFieldPDF = (label, obj, showLabel) => {
  const safeItems = objEntryTexts(obj);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      <View wrap={false}>
        {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.listItem}>1. {safeItems[0]}</Text>
      </View>
      {safeItems.slice(1).map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 2}. {item}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS — mirror JSX sections exactly (4-AREA RULE).
   hideZero mirrors JSX HIDE_ZERO_FIELDS: ALL 10 numerics — 0 = test not performed in this assessment
   (a sprint time or VO2 max of 0 is not physically possible — 0 is an extraction sentinel).
   Real decimals (e.g. sprintTime 4.42) still display.
   `date` is header-only (line under the record title) — never a section field.
   `nextAssessmentDate` IS a section field — a simple row whose value goes through formatDate (isDate).
   `bodyCompositionMetrics` is an object — read-only "key: value" lines (isObject). */
const SECTION_CONFIGS = [
  {
    title: 'Assessment Overview',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'sportType', label: 'Sport' },
      { key: 'athleteLevel', label: 'Athlete Level' },
      { key: 'assessmentPurpose', label: 'Assessment Purpose', isSentence: true },
      { key: 'nextAssessmentDate', label: 'Next Assessment Date', isDate: true },
    ],
  },
  {
    title: 'Performance Metrics',
    fields: [
      { key: 'vo2MaxValue', label: 'VO2 Max (ml/kg/min)', hideZero: true },
      { key: 'lactateThreshold', label: 'Lactate Threshold', hideZero: true },
      { key: 'verticalJumpHeight', label: 'Vertical Jump (cm)', hideZero: true },
      { key: 'sprintTime', label: 'Sprint Time (sec)', hideZero: true },
      { key: 'functionalMovementScore', label: 'Functional Movement Score', hideZero: true },
      { key: 'agilityTestScore', label: 'Agility Test Score', hideZero: true },
      { key: 'reactionTime', label: 'Reaction Time (sec)', hideZero: true },
      { key: 'balanceStabilityScore', label: 'Balance/Stability Score', hideZero: true },
      { key: 'powerOutput', label: 'Power Output (W)', hideZero: true },
      { key: 'enduranceCapacity', label: 'Endurance Capacity', isSentence: true },
      { key: 'bodyCompositionMetrics', label: 'Body Composition', isObject: true },
    ],
  },
  {
    title: 'Strength & Biomechanics',
    fields: [
      { key: 'isokinetricStrengthData', label: 'Isokinetic Strength Data', isArray: true },
      { key: 'asymmetryPercentage', label: 'Asymmetry (%)', hideZero: true },
      { key: 'rangeOfMotionMeasurements', label: 'Range of Motion', isArray: true },
      { key: 'strengthDeficits', label: 'Strength Deficits', isArray: true },
      { key: 'biomechanicalAnalysis', label: 'Biomechanical Analysis', isSentence: true },
    ],
  },
  {
    title: 'Limitations & Clearance',
    fields: [
      { key: 'performanceLimitingFactors', label: 'Performance Limiting Factors', isArray: true },
      { key: 'injuryHistorySummary', label: 'Injury History Summary', isArray: true },
      { key: 'returnToPlayClearance', label: 'Return-to-Play Clearance' },
    ],
  },
  {
    title: 'Training Recommendations',
    fields: [
      { key: 'trainingRecommendations', label: 'Training Recommendations', isArray: true },
    ],
  },
];

const fieldHasVal = (record, f) => {
  const v = record[f.key];
  if (f.hideZero && v === 0) return false;
  if (f.isArray) {
    return Array.isArray(v) && v.some(item => arrItemText(item));
  }
  if (f.isObject) {
    return objEntryTexts(v).length > 0;
  }
  return hasVal(v);
};

/* ======= COMPONENT ======= */
const PerformanceAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.performance_assessment) return Array.isArray(r.performance_assessment) ? r.performance_assessment : [r.performance_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.performance_assessment) return Array.isArray(dd.performance_assessment) ? dd.performance_assessment : [dd.performance_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Performance Assessment</Text>
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
          <Text style={styles.documentTitle}>Performance Assessment</Text>
        </View>

        {records.map((record, index) => {
          const recordNum = (record._originalIdx ?? index) + 1;
          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header — no meta pills; `date` renders as the first row of Assessment Overview */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {`Performance Assessment ${recordNum}`}
                </Text>
              </View>

              {/* Sections */}
              {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
                const presentFields = sectionConfig.fields.filter(f => fieldHasVal(record, f));
                if (presentFields.length === 0) return null;

                const renderField = (field) => {
                  const val = record[field.key];
                  const showLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                  if (field.isArray) return renderArrayFieldPDF(field.label, val, showLabel);
                  if (field.isObject) return renderObjectFieldPDF(field.label, val, showLabel);
                  if (field.isSentence) return renderSentenceField(field.label, val, showLabel);
                  if (field.isDate) return renderFieldRow(field.label, formatDate(val), showLabel);
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
          );
        })}
      </Page>
    </Document>
  );
};

export default PerformanceAssessmentDocumentPDFTemplate;
