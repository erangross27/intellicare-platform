/**
 * VentilatorSettingsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — ventilator settings
 * Collection: ventilator_settings
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  statusBadge: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1f2937', textTransform: 'uppercase', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  objLeaf: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  objLeafLabel: { fontFamily: 'Helvetica-Bold' },
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

/* Helper to format nested object (value + unit) */
const formatNestedValue = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  if (Object.keys(obj).length === 0) return null;
  if (obj.value && obj.unit) return `${obj.value} ${obj.unit}`;
  if (obj.set !== undefined || obj.total !== undefined) {
    const parts = [];
    if (obj.set !== undefined) parts.push(`Set: ${obj.set}`);
    if (obj.total !== undefined) parts.push(`Total: ${obj.total}`);
    return parts.join(', ');
  }
  if (obj.value !== undefined) return String(obj.value);
  return null;
};

const NESTED_FIELDS = ['tidalVolume', 'respiratoryRate', 'peep', 'pressureSupport', 'peakPressure', 'plateauPressure', 'minuteVentilation'];

/* humanizeKey: object-key -> readable label */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

/* Flatten a dynamic-key object into indented label/value lines (no [object Object]) */
const flattenObjectLines = (obj) => {
  const lines = [];
  const walk = (node, depth) => {
    Object.entries(node).forEach(([k, v]) => {
      if (isEmptyDeep(v)) return;
      if (isScalar(v)) lines.push({ depth, label: humanizeKey(k), value: fmtScalar(v) });
      else if (Array.isArray(v)) {
        const items = v.filter(x => !isEmptyDeep(x));
        if (items.every(isScalar)) lines.push({ depth, label: humanizeKey(k), value: items.map(fmtScalar).join(', ') });
        else { lines.push({ depth, label: humanizeKey(k), value: null }); items.forEach((it, i) => { if (isScalar(it)) lines.push({ depth: depth + 1, label: `${humanizeKey(k)} ${i + 1}`, value: fmtScalar(it) }); else walk(it, depth + 1); }); }
      } else { lines.push({ depth, label: humanizeKey(k), value: null }); walk(v, depth + 1); }
    });
  };
  if (obj && typeof obj === 'object') walk(obj, 0);
  return lines;
};

/* renderObjectFieldPDF: recursive dynamic-key object (e.g. results) */
const renderObjectFieldPDF = (label, value) => {
  if (isScalar(value) || isEmptyDeep(value)) return null;
  const lines = flattenObjectLines(value);
  if (lines.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={lines.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {lines.map((ln, i) => (
        ln.value === null
          ? <Text key={i} style={[styles.nestedSubtitle, { marginLeft: ln.depth * 10 }]}>{ln.label}</Text>
          : <Text key={i} style={[styles.objLeaf, { marginLeft: 8 + ln.depth * 10 }]}><Text style={styles.objLeafLabel}>{ln.label}: </Text>{ln.value}</Text>
      ))}
    </View>
  );
};

/* renderRecommendationsPDF: array of {recommendation, date} (no [object Object]) */
const renderRecommendationsPDF = (label, value) => {
  if (!Array.isArray(value)) return null;
  const recs = value.filter(r => !isEmptyDeep(r));
  if (recs.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={recs.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {recs.map((rec, i) => {
        const rt = (typeof rec === 'object' ? (rec?.recommendation || '') : String(rec ?? '')).trim();
        const rd = (typeof rec === 'object' ? (rec?.date || '') : '').trim();
        if (!rt) return null;
        return <Text key={i} style={styles.listItem}>{i + 1}. {rt}{rd ? ` (${rd})` : ''}</Text>;
      })}
    </View>
  );
};

/* renderFieldRow: label + value inside fieldBox */
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

/* renderNestedField */
const renderNestedFieldPDF = (label, value) => {
  const displayVal = formatNestedValue(value);
  if (!displayVal) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{displayVal}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
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
const SECTION_CONFIGS = [
  {
    title: 'General Information',
    fields: [
      { key: 'mode', label: 'Mode', isSentence: true },
      { key: 'status', label: 'Status' },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'date', label: 'Date', isDate: true },
    ],
  },
  {
    title: 'Ventilator Parameters',
    fields: [
      { key: 'tidalVolume', label: 'Tidal Volume', isNested: true },
      { key: 'respiratoryRate', label: 'Respiratory Rate', isNested: true },
      { key: 'peep', label: 'PEEP', isNested: true },
      { key: 'fio2', label: 'FiO2', isSentence: true },
      { key: 'pressureSupport', label: 'Pressure Support', isNested: true },
      { key: 'peakPressure', label: 'Peak Pressure', isNested: true },
      { key: 'plateauPressure', label: 'Plateau Pressure', isNested: true },
      { key: 'minuteVentilation', label: 'Minute Ventilation', isNested: true },
    ],
  },
  {
    title: 'Clinical Assessment',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
      { key: 'assessment', label: 'Assessment', isSentence: true },
    ],
  },
  {
    title: 'Plan & Recommendations',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
      { key: 'recommendations', label: 'Recommendations', isObjectArray: true },
    ],
  },
  {
    title: 'Results',
    fields: [
      { key: 'results', label: 'Results', isObject: true },
    ],
  },
  {
    title: 'Notes',
    fields: [
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const VentilatorSettingsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.ventilator_settings) return Array.isArray(r.ventilator_settings) ? r.ventilator_settings : [r.ventilator_settings];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ventilator_settings) return Array.isArray(dd.ventilator_settings) ? dd.ventilator_settings : [dd.ventilator_settings]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Ventilator Settings</Text>
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
          <Text style={styles.documentTitle}>Ventilator Settings</Text>
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
                Ventilator Settings {index + 1}
              </Text>
              {record.status && (
                <Text style={styles.statusBadge}>Status: {record.status}</Text>
              )}
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => {
                if (f.isNested) return !!formatNestedValue(record[f.key]);
                if (f.isObject) return !isScalar(record[f.key]) && !isEmptyDeep(record[f.key]);
                if (f.isObjectArray) return Array.isArray(record[f.key]) && record[f.key].filter(r => !isEmptyDeep(r)).length > 0;
                return hasVal(record[f.key]);
              });
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (field.isNested) return <View key={fIdx}>{renderNestedFieldPDF(field.label, val)}</View>;
                    if (field.isObject) return <View key={fIdx}>{renderObjectFieldPDF(field.label, val)}</View>;
                    if (field.isObjectArray) return <View key={fIdx}>{renderRecommendationsPDF(field.label, val)}</View>;
                    if (!hasVal(val)) return null;
                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val)}</View>;
                    if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                    return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
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

export default VentilatorSettingsDocumentPDFTemplate;
