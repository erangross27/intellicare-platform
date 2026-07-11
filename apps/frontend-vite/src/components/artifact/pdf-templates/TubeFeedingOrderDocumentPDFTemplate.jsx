/**
 * TubeFeedingOrderDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — tube feeding orders — NO BLUE
 * Collection: tube_feeding_order
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
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

/* For tube-feeding quantities, 0 is a sentinel ("not ordered / not applicable"), never a
   meaningful value — mirror the UI's hide-zero behavior so the PDF doesn't print "0" for
   N/A fields (e.g. bolusVolume:0 on a continuous feed, gastricResidualVolumeThreshold:0 on
   a post-pyloric tube). No tube-feeding numeric has a meaningful zero. */
const MEANINGFUL_ZERO_FIELDS = [];
const isHiddenZero = (key, val, isNumber) => isNumber && val === 0 && !MEANINGFUL_ZERO_FIELDS.includes(key);

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

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, showLabel = true) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text, showLabel = true) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
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

  const wrapProp = rows.length > 8 ? undefined : false;

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

/* renderArrayField */
const renderArrayFieldPDF = (label, items, showLabel = true) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
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
    title: 'Formula Information',
    fields: [
      { key: 'formulaName', label: 'Formula Name', isSentence: true },
      { key: 'formulaCaloriesDensity', label: 'Formula Calories Density', isNumber: true },
      { key: 'proteinContentPerLiter', label: 'Protein Content Per Liter', isNumber: true },
    ],
  },
  {
    title: 'Feeding Route & Method',
    fields: [
      { key: 'feedingRouteType', label: 'Feeding Route Type', isSentence: true },
      { key: 'feedingTubeSize', label: 'Feeding Tube Size', isNumber: true },
      { key: 'feedingMethodType', label: 'Feeding Method Type', isSentence: true },
    ],
  },
  {
    title: 'Rate & Advancement',
    fields: [
      { key: 'initialInfusionRate', label: 'Initial Infusion Rate', isNumber: true },
      { key: 'goalInfusionRate', label: 'Goal Infusion Rate', isNumber: true },
      { key: 'rateAdvancementSchedule', label: 'Rate Advancement Schedule', isSentence: true },
    ],
  },
  {
    title: 'Caloric & Protein Goals',
    fields: [
      { key: 'dailyCaloricGoal', label: 'Daily Caloric Goal', isNumber: true },
      { key: 'dailyProteinGoal', label: 'Daily Protein Goal', isNumber: true },
    ],
  },
  {
    title: 'Water Flush Protocol',
    fields: [
      { key: 'freeWaterFlushVolume', label: 'Free Water Flush Volume', isNumber: true },
      { key: 'freeWaterFlushFrequency', label: 'Free Water Flush Frequency', isSentence: true },
    ],
  },
  {
    title: 'Gastric Monitoring',
    fields: [
      { key: 'gastricResidualVolumeThreshold', label: 'Gastric Residual Volume Threshold', isNumber: true },
      { key: 'gastricResidualCheckFrequency', label: 'Gastric Residual Check Frequency', isSentence: true },
    ],
  },
  {
    title: 'Safety & Positioning',
    fields: [
      { key: 'headOfBedElevation', label: 'Head of Bed Elevation', isNumber: true },
      { key: 'prokineticsOrdered', label: 'Prokinetics Ordered', isBoolean: true },
    ],
  },
  {
    title: 'Cyclic & Bolus Feeding',
    fields: [
      { key: 'cyclicFeedingStartTime', label: 'Cyclic Feeding Start Time', isSentence: true },
      { key: 'cyclicFeedingDurationHours', label: 'Cyclic Feeding Duration (Hours)', isNumber: true },
      { key: 'bolusVolume', label: 'Bolus Volume', isNumber: true },
      { key: 'bolusFrequency', label: 'Bolus Frequency', isSentence: true },
    ],
  },
  {
    title: 'Supplements & Patency',
    fields: [
      { key: 'modularsSupplements', label: 'Modulars / Supplements', isArray: true },
      { key: 'tubePatencyFlushSolution', label: 'Tube Patency Flush Solution', isSentence: true },
    ],
  },
  {
    title: 'Risk & Glycemic',
    fields: [
      { key: 'refeedingSyndromeRisk', label: 'Refeeding Syndrome Risk', isBoolean: true },
      { key: 'glycemicControlProtocol', label: 'Glycemic Control Protocol', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const TubeFeedingOrderDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.tube_feeding_order) return Array.isArray(r.tube_feeding_order) ? r.tube_feeding_order : [r.tube_feeding_order];
      if (r?.tube_feeding_orders) return Array.isArray(r.tube_feeding_orders) ? r.tube_feeding_orders : [r.tube_feeding_orders];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.tube_feeding_order) return Array.isArray(dd.tube_feeding_order) ? dd.tube_feeding_order : [dd.tube_feeding_order]; if (dd?.tube_feeding_orders) return Array.isArray(dd.tube_feeding_orders) ? dd.tube_feeding_orders : [dd.tube_feeding_orders]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Tube Feeding Orders</Text>
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
          <Text style={styles.documentTitle}>Tube Feeding Orders</Text>
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
                {`Tube Feeding Order ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]) && !isHiddenZero(f.key, record[f.key], f.isNumber));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;
                    if (isHiddenZero(field.key, val, field.isNumber)) return null;
                    const showFieldLabel = field.label.toLowerCase() !== (sectionConfig.title || '').toLowerCase();

                    if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val, showFieldLabel)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val, showFieldLabel)}</View>;
                    if (field.isBoolean) return <View key={fIdx}>{renderFieldRow(field.label, val, showFieldLabel)}</View>;
                    if (field.isNumber) return <View key={fIdx}>{renderFieldRow(field.label, val, showFieldLabel)}</View>;
                    return <View key={fIdx}>{renderFieldRow(field.label, val, showFieldLabel)}</View>;
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

export default TubeFeedingOrderDocumentPDFTemplate;
