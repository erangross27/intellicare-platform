/**
 * RheumatologicMonitoringDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — rheumatologic monitoring
 * Collection: rheumatologic_monitoring
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
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatKey = (key) => key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\s+/g, ' ').trim();

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

/* renderDateField */
const renderDateFieldPDF = (label, value, showLabel = true) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
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

/* renderDiseaseActivityMonitoring: object with nested array */
const renderDiseaseActivityPDF = (label, obj, showLabel = true) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {hasVal(obj.frequency) && (
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.nestedSubtitle}>Frequency</Text>
          <Text style={styles.listItem}>{safeString(obj.frequency)}</Text>
        </View>
      )}
      {hasVal(obj.lastAssessment) && (
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.nestedSubtitle}>Last Assessment</Text>
          <Text style={styles.listItem}>{safeString(obj.lastAssessment)}</Text>
        </View>
      )}
      {Array.isArray(obj.parameters) && obj.parameters.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.nestedSubtitle}>Parameters</Text>
          {obj.parameters.filter(Boolean).map((p, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(p)}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

/* renderMedicationMonitoring: array of objects */
const renderMedicationMonitoringPDF = (label, items, showLabel = true) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {items.map((med, mIdx) => (
        <View key={mIdx} style={{ marginBottom: 6 }}>
          <Text style={styles.nestedSubtitle}>{safeString(med.medication) || `Medication ${mIdx + 1}`}</Text>
          {Array.isArray(med.monitoring) && med.monitoring.filter(Boolean).map((m, mi) => (
            <Text key={mi} style={styles.listItem}>{mi + 1}. {safeString(m)}</Text>
          ))}
          {hasVal(med.frequency) && (
            <Text style={styles.listItem}>Frequency: {safeString(med.frequency)}</Text>
          )}
        </View>
      ))}
    </View>
  );
};

/* humanizeKey + scalar/empty helpers for recursive object (results) */
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
const isScalar = (v) => v === null || typeof v !== 'object';

/* renderRecursiveObjectPDF: recursive nested object (results) */
const renderRecursiveObjectNodePDF = (obj, depth) => {
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyDeep(v));
  const out = [];
  entries.forEach(([k, v], i) => {
    if (isScalar(v)) {
      out.push(<Text key={`${depth}-${i}-l`} style={[styles.listItem, { paddingLeft: 8 + depth * 8 }]}>{humanizeKey(k)}: {safeString(v)}</Text>);
    } else {
      out.push(<Text key={`${depth}-${i}-h`} style={[styles.nestedSubtitle, { paddingLeft: depth * 8 }]}>{humanizeKey(k)}</Text>);
      out.push(...renderRecursiveObjectNodePDF(v, depth + 1));
    }
  });
  return out;
};
const renderRecursiveObjectPDF = (label, obj, showLabel = true) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || isEmptyDeep(obj)) return null;
  const rows = renderRecursiveObjectNodePDF(obj, 0);
  if (rows.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={rows.length > 8 ? undefined : false}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows}
    </View>
  );
};

/* renderObjectKeyValue: for immunizationStatus, screeningProtocols */
const renderObjectKeyValuePDF = (label, obj, showLabel = true) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;

  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {entries.map(([key, value], i) => (
        <View key={i} style={{ marginBottom: 3 }}>
          <Text style={styles.nestedSubtitle}>{formatKey(key)}</Text>
          <Text style={styles.listItem}>{safeString(value)}</Text>
        </View>
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
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
  {
    title: 'Disease Activity Monitoring',
    fields: [
      { key: 'diseaseActivityMonitoring', label: 'Disease Activity Monitoring', isDiseaseActivity: true },
    ],
  },
  {
    title: 'Medication Monitoring',
    fields: [
      { key: 'medicationMonitoring', label: 'Medication Monitoring', isMedicationMonitoring: true },
    ],
  },
  {
    title: 'Immunization Status',
    fields: [
      { key: 'immunizationStatus', label: 'Immunization Status', isObjectKeyValue: true },
    ],
  },
  {
    title: 'Screening Protocols',
    fields: [
      { key: 'screeningProtocols', label: 'Screening Protocols', isObjectKeyValue: true },
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
    title: 'Results',
    fields: [
      { key: 'results', label: 'Results', isRecursiveObject: true },
    ],
  },
  {
    title: 'Plan',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
      { key: 'recommendations', label: 'Recommendations', isArray: true },
    ],
  },
  {
    title: 'Notes',
    fields: [
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
];

/* recommendations may be strings or {recommendation} objects */
const normalizeArrayItems = (items) => (Array.isArray(items) ? items : []).map(it =>
  (it && typeof it === 'object') ? String(it.recommendation ?? it.text ?? '') : String(it ?? '')
).filter(s => s.trim());

/* ======= COMPONENT ======= */
const RheumatologicMonitoringDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.rheumatologic_monitoring) return Array.isArray(r.rheumatologic_monitoring) ? r.rheumatologic_monitoring : [r.rheumatologic_monitoring];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.rheumatologic_monitoring) return Array.isArray(dd.rheumatologic_monitoring) ? dd.rheumatologic_monitoring : [dd.rheumatologic_monitoring]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Rheumatologic Monitoring</Text>
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
          <Text style={styles.documentTitle}>Rheumatologic Monitoring</Text>
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
                {`Rheumatologic Monitoring ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => hasVal(record[f.key]));
              if (presentFields.length === 0) return null;

              /* Count total items for wrap/break decisions */
              let totalItems = presentFields.length;
              presentFields.forEach(f => {
                const v = record[f.key];
                if (Array.isArray(v)) totalItems += v.length;
                else if (typeof v === 'object' && v !== null) {
                  totalItems += Object.keys(v).length;
                  if (v.parameters && Array.isArray(v.parameters)) totalItems += v.parameters.length;
                }
                else if (typeof v === 'string') {
                  const s = splitBySentence(v);
                  if (s.length > 1) totalItems += s.length;
                }
              });

              const breakProp = totalItems >= 15 ? true : undefined;

              const renderField = (field) => {
                const val = record[field.key];
                const showFieldLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                if (field.isDate) return renderDateFieldPDF(field.label, val, showFieldLabel);
                if (field.isDiseaseActivity) return renderDiseaseActivityPDF(field.label, val, showFieldLabel);
                if (field.isMedicationMonitoring) return renderMedicationMonitoringPDF(field.label, val, showFieldLabel);
                if (field.isRecursiveObject) return renderRecursiveObjectPDF(field.label, val, showFieldLabel);
                if (field.isObjectKeyValue) return renderObjectKeyValuePDF(field.label, val, showFieldLabel);
                if (field.isArray) return renderArrayFieldPDF(field.label, normalizeArrayItems(val), showFieldLabel);
                if (field.isSentence) return renderSentenceSection(field.label, val, showFieldLabel);
                return renderFieldRow(field.label, val, showFieldLabel);
              };

              return (
                <View key={sIdx} style={styles.section} break={breakProp}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderField(presentFields[0])}
                  </View>
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

export default RheumatologicMonitoringDocumentPDFTemplate;
