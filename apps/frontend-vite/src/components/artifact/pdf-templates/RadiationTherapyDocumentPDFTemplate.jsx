/**
 * RadiationTherapyDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — radiation therapy
 * Collection: radiation_therapy
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
  objSubLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 1 },
  objNested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', borderLeftStyle: 'solid', marginTop: 2 },
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

/* Format an object-array item like {toxicity, expectedGrade|timing} → "Toxicity — Detail" */
const formatObjItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item !== 'object') return String(item);
  const main = item.toxicity || item.name || item.type || item.event || '';
  const detail = item.expectedGrade || item.timing || item.grade || item.severity || item.description || '';
  const combined = [main, detail].filter(Boolean).join(' — ');
  return combined || Object.values(item).filter(Boolean).join(' — ');
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* ═══════ OBJECT-FIELD HELPERS (for `results` recursive render) ═══════ */
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
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
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
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(typeof item === 'object' ? (item.recommendation || item.text || JSON.stringify(item)) : item)}</Text>
      ))}
    </View>
  );
};

/* renderObjectArrayFieldPDF: array of objects like {toxicity, expectedGrade|timing} */
const renderObjectArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items)) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(formatObjItem(item))}</Text>
      ))}
    </View>
  );
};

/* renderObjectNodePDF: recursive label(bold) + value(line below) — grayscale, no inline "Label: value" */
const renderObjectNodePDF = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.objSubLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.objNested : undefined}>{entries.map(([k, v]) => renderObjectNodePDF(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* renderObjectFieldPDF: OBJECT field (results) — Rule #74 per-entry wrap gating on countRows */
const renderObjectFieldPDF = (label, val) => {
  if (!hasVal(val) || isScalar(val)) return null;
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return entries.map(([k, v], i) => {
    const rows = countRows(v);
    return (
      <View key={`results-${k}`} style={styles.fieldBox} wrap={rows > 8 ? undefined : false}>
        {i === 0 ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {renderObjectNodePDF(humanizeKey(k), v, `results-${k}`, 1)}
      </View>
    );
  });
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Treatment Overview',
    fields: [
      { key: 'indication', label: 'Indication', isSentence: true },
      { key: 'site', label: 'Site', isSentence: true },
      { key: 'intent', label: 'Intent', isSentence: true },
      { key: 'technique', label: 'Technique', isSentence: true },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
  {
    title: 'Dose Information',
    fields: [
      { key: 'dose', label: 'Dose Per Fraction', isSentence: true },
      { key: 'totalDose', label: 'Total Dose', isSentence: true },
      { key: 'boostDose', label: 'Boost Dose', isSentence: true },
      { key: 'fractions', label: 'Fractions', isSentence: true },
    ],
  },
  {
    title: 'Treatment Schedule',
    fields: [
      { key: 'startDate', label: 'Start Date', isDate: true },
      { key: 'endDate', label: 'End Date', isDate: true },
      { key: 'completionStatus', label: 'Completion Status', isSentence: true },
      { key: 'concurrentChemo', label: 'Concurrent Chemotherapy' },
      { key: 'concurrentChemotherapy', label: 'Concurrent Chemotherapy' },
    ],
  },
  {
    title: 'Toxicities',
    fields: [
      { key: 'acuteToxicities', label: 'Acute Toxicities', isObjectArray: true },
      { key: 'lateToxicities', label: 'Late Toxicities', isObjectArray: true },
      { key: 'complications', label: 'Complications', isArray: true },
    ],
  },
  {
    title: 'Planning',
    fields: [
      // `planning` is a dynamic-key object {timing, simulationDate, positioning, acquisition,
      // imageGuidance, respiratoryGating, targetVolumes, …}; keys vary per record — render via
      // recursive object node so all actual keys appear (no hardcoded target/schedule).
      { key: 'planning', label: 'Treatment Planning', isObject: true },
    ],
  },
  {
    title: 'Side Effects',
    fields: [
      { key: 'sideEffects', label: 'Side Effects', isArray: true },
    ],
  },
  {
    title: 'Clinical Assessment',
    fields: [
      { key: 'response', label: 'Response', isSentence: true },
      { key: 'results', label: 'Results', isObject: true },
      { key: 'assessment', label: 'Assessment', isSentence: true },
      { key: 'findings', label: 'Findings', isSentence: true },
    ],
  },
  {
    title: 'Treatment Plan',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
      { key: 'recommendations', label: 'Recommendations', isArray: true },
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
];

/* Helper to get nested value */
const getNestedVal = (obj, path) => {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
};

/* ======= COMPONENT ======= */
const RadiationTherapyDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.radiation_therapy) return Array.isArray(r.radiation_therapy) ? r.radiation_therapy : [r.radiation_therapy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.radiation_therapy) return Array.isArray(dd.radiation_therapy) ? dd.radiation_therapy : [dd.radiation_therapy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Radiation Therapy</Text>
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
          <Text style={styles.documentTitle}>Radiation Therapy</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.startDate && (
                  <Text style={styles.recordDate}>{formatDate(record.startDate)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {`Radiation Therapy ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => {
                const val = f.nested ? getNestedVal(record, f.key) : record[f.key];
                return hasVal(val);
              });
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = field.nested ? getNestedVal(record, field.key) : record[field.key];
                    if (!hasVal(val)) return null;

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isObject) return <React.Fragment key={fIdx}>{renderObjectFieldPDF(field.label, val)}</React.Fragment>;
                    if (field.isObjectArray) return <View key={fIdx}>{renderObjectArrayFieldPDF(field.label, val)}</View>;
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

export default RadiationTherapyDocumentPDFTemplate;
