/**
 * AnesthesiaComplicationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — anesthesia complications
 * Collection: anesthesia_complications
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
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  const showLabel = label !== '';
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  const showLabel = label !== '';
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderBooleanField */
const renderBooleanFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  const showLabel = label !== '';
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{value ? 'Yes' : 'No'}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;
  const showLabel = label !== '';

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

/* humanizeKey: object-key -> readable label */
const humanizeKey = (key) => {
  if (!key && key !== 0) return '';
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => {
  if (v === null || v === undefined || v === '') return true;
  if (typeof v === 'number' || typeof v === 'boolean') return false;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.every(isEmptyDeep);
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
/* flattenObjectLines: dynamic object -> [{indent, label, value}] readable rows */
const flattenObjectLines = (obj, depth) => {
  const d = depth || 0;
  const rows = [];
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (isEmptyDeep(v)) return;
    if (isScalar(v)) rows.push({ depth: d, label: humanizeKey(k), value: safeString(v) });
    else if (Array.isArray(v)) rows.push({ depth: d, label: humanizeKey(k), value: v.filter(x => !isEmptyDeep(x)).map(x => isScalar(x) ? safeString(x) : Object.entries(x).filter(([, vv]) => !isEmptyDeep(vv)).map(([kk, vv]) => `${humanizeKey(kk)}: ${safeString(vv)}`).join(', ')).join('; ') });
    else { rows.push({ depth: d, label: humanizeKey(k), value: null }); flattenObjectLines(v, d + 1).forEach(r => rows.push(r)); }
  });
  return rows;
};

/* renderObjectFieldPDF: dynamic-key object -> nested subtitle/value rows */
const renderObjectFieldPDF = (label, value) => {
  if (!value || isScalar(value) || isEmptyDeep(value)) return null;
  const rows = flattenObjectLines(value);
  if (rows.length === 0) return null;
  const showLabel = label !== '';
  return (
    <View style={styles.fieldBox} wrap={rows.length > 8 ? undefined : false}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => (
        row.value === null
          ? <Text key={i} style={styles.nestedSubtitle}>{row.label}</Text>
          : <Text key={i} style={styles.listItem}>{row.label}: {row.value}</Text>
      ))}
    </View>
  );
};

/* renderArrayField */
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;
  const showLabel = label !== '';

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
    title: 'Record Information',
    fields: [
      { key: 'anesthesiologistName', label: 'Anesthesiologist Name', isSentence: true },
      { key: 'asaClassification', label: 'ASA Classification', isSentence: true },
      { key: 'mallampatiScore', label: 'Mallampati Score', isSentence: true },
      { key: 'anesthesiaType', label: 'Anesthesia Type', isSentence: true },
      { key: 'procedureName', label: 'Procedure Name', isSentence: true },
    ],
  },
  {
    title: 'Complication Details',
    fields: [
      { key: 'complicationType', label: 'Complication Type', isSentence: true },
      { key: 'severityGrade', label: 'Severity Grade', isSentence: true },
      { key: 'complicationOnsetTime', label: 'Complication Onset Time', isDate: true },
      { key: 'timingRelativeToInduction', label: 'Timing Relative to Induction', isSentence: true },
    ],
  },
  {
    title: 'Agents & Medications',
    fields: [
      { key: 'anestheticAgents', label: 'Anesthetic Agents', isArray: true },
      { key: 'medicationsAdministered', label: 'Medications Administered', isArray: true },
    ],
  },
  {
    title: 'Vital Signs & Airway',
    fields: [
      { key: 'vitalSignsAtOnset', label: 'Vital Signs at Onset', isObject: true },
      { key: 'airwayManagementMethod', label: 'Airway Management Method', isSentence: true },
      { key: 'difficultAirwayEncountered', label: 'Difficult Airway Encountered', isBoolean: true },
    ],
  },
  {
    title: 'Interventions',
    fields: [
      { key: 'interventionsPerformed', label: 'Interventions Performed', isArray: true },
    ],
  },
  {
    title: 'Patient History',
    fields: [
      { key: 'preexistingConditions', label: 'Preexisting Conditions', isArray: true },
      { key: 'contributingFactors', label: 'Contributing Factors', isArray: true },
    ],
  },
  {
    title: 'Outcomes',
    fields: [
      { key: 'aspirationOccurred', label: 'Aspiration Occurred', isBoolean: true },
      { key: 'awarenessDuringAnesthesia', label: 'Awareness During Anesthesia', isBoolean: true },
      { key: 'malignantHyperthermiaSuspected', label: 'Malignant Hyperthermia Suspected', isBoolean: true },
      { key: 'cardiacArrestOccurred', label: 'Cardiac Arrest Occurred', isBoolean: true },
      { key: 'resuscitationPerformed', label: 'Resuscitation Performed', isBoolean: true },
      { key: 'nerveDamageLocation', label: 'Nerve Damage Location', isSentence: true },
      { key: 'icuAdmissionRequired', label: 'ICU Admission Required', isBoolean: true },
      { key: 'reportedToQualityAssurance', label: 'Reported to Quality Assurance', isBoolean: true },
    ],
  },
];

/* Helper to get field value */
const getNestedVal = (record, key) => record[key];

/* hasFieldVal: object fields require non-empty-deep */
const hasFieldVal = (field, val) => {
  if (field.isObject) return val && !isScalar(val) && !isEmptyDeep(val);
  return hasVal(val);
};

/* ======= COMPONENT ======= */
const AnesthesiaComplicationsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.anesthesia_complications) return Array.isArray(r.anesthesia_complications) ? r.anesthesia_complications : [r.anesthesia_complications];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.anesthesia_complications) return Array.isArray(dd.anesthesia_complications) ? dd.anesthesia_complications : [dd.anesthesia_complications]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Anesthesia Complications</Text>
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
          <Text style={styles.documentTitle}>Anesthesia Complications</Text>
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
                {`Anesthesia Complication ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => hasFieldVal(f, getNestedVal(record, f.key)));
              if (presentFields.length === 0) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {presentFields.map((field, fIdx) => {
                    const val = getNestedVal(record, field.key);

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
                    if (field.isBoolean) return <View key={fIdx}>{renderBooleanFieldPDF(field.label, val)}</View>;
                    if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val)}</View>;
                    if (field.isObject) return <View key={fIdx}>{renderObjectFieldPDF(field.label, val)}</View>;
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

export default AnesthesiaComplicationsDocumentPDFTemplate;
