/**
 * RheumatologicAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — rheumatologic assessment
 * Collection: rheumatologic_assessment
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
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', borderLeftStyle: 'solid', marginTop: 2 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
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

const SEMICOLON_FIELDS = ['symptomDuration'];

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

const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/* count rows for the wrap heuristic (recursive object) */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNodePDF = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{safeString(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNodePDF(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split, with semicolon support */
const renderSentenceField = (label, text, sectionTitle, fieldName, showLabel) => {
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
const renderArrayFieldPDF = (label, items, showLabel) => {
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

/* renderObjectField (morningStiffness: present as Yes/No, duration as string, improvesWithActivity as Yes/No) */
const renderObjectFieldPDF = (label, obj, showLabel) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;

  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {entries.map(([key, value], i) => {
        const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        const displayVal = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : safeString(value);
        return (
          <Text key={i} style={styles.listItem}>{formattedKey}: {displayVal}</Text>
        );
      })}
    </View>
  );
};

/* renderComplexObjectField (jointInvolvement with nested arrays) */
const renderComplexObjectFieldPDF = (label, obj, showLabel) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;

  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {entries.map(([key, value], i) => {
        const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        if (Array.isArray(value)) {
          const safeItems = value.filter(Boolean);
          if (safeItems.length === 0) return null;
          return (
            <View key={i}>
              <Text style={styles.nestedSubtitle}>{formattedKey}</Text>
              {safeItems.map((item, j) => (
                <Text key={j} style={styles.listItem}>{j + 1}. {safeString(item)}</Text>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={styles.listItem}>{formattedKey}: {safeString(value)}</Text>
        );
      })}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'chief-complaint': 'Chief Complaint',
  'morning-stiffness': 'Morning Stiffness',
  'joint-involvement': 'Joint Involvement',
  'systemic-symptoms': 'Systemic Symptoms',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'results': 'Results',
  'recommendations': 'Recommendations',
  'notes': 'Notes',
};

const SECTION_CONFIGS = [
  {
    id: 'record-info',
    title: 'Record Information',
    fields: [
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
  {
    id: 'chief-complaint',
    title: 'Chief Complaint',
    fields: [
      { key: 'chiefComplaint', label: 'Chief Complaint', isSentence: true },
      { key: 'symptomDuration', label: 'Symptom Duration', isSentence: true },
    ],
  },
  {
    id: 'morning-stiffness',
    title: 'Morning Stiffness',
    fields: [
      { key: 'morningStiffness', label: 'Morning Stiffness', isObject: true },
    ],
  },
  {
    id: 'joint-involvement',
    title: 'Joint Involvement',
    fields: [
      { key: 'jointInvolvement', label: 'Joint Involvement', isComplexObject: true },
    ],
  },
  {
    id: 'systemic-symptoms',
    title: 'Systemic Symptoms',
    fields: [
      { key: 'systemicSymptoms', label: 'Systemic Symptoms', isArray: true },
    ],
  },
  {
    id: 'findings',
    title: 'Findings',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
    ],
  },
  {
    id: 'assessment',
    title: 'Assessment',
    fields: [
      { key: 'assessment', label: 'Assessment', isSentence: true },
    ],
  },
  {
    id: 'plan',
    title: 'Plan',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
    ],
  },
  {
    id: 'results',
    title: 'Results',
    fields: [
      { key: 'results', label: 'Results', isRecursiveObject: true },
    ],
  },
  {
    id: 'recommendations',
    title: 'Recommendations',
    fields: [
      { key: 'recommendations', label: 'Recommendations', isObjectArray: true },
    ],
  },
  {
    id: 'notes',
    title: 'Notes',
    fields: [
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const RheumatologicAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.rheumatologic_assessment) return Array.isArray(r.rheumatologic_assessment) ? r.rheumatologic_assessment : [r.rheumatologic_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.rheumatologic_assessment) return Array.isArray(dd.rheumatologic_assessment) ? dd.rheumatologic_assessment : [dd.rheumatologic_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Rheumatologic Assessment</Text>
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
          <Text style={styles.documentTitle}>Rheumatologic Assessment</Text>
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
                {`Rheumatologic Assessment ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              let isFirstField = true;

              return (
                <View key={sIdx} style={styles.section}>
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
                      const safeItems = (Array.isArray(val) ? val : []).filter(Boolean);
                      if (safeItems.length === 0) return null;
                      isFirstField = false;
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
                    if (field.isObject) {
                      isFirstField = false;
                      return (
                        <View key={fIdx} wrap={sectionTitleForField ? false : undefined}>
                          {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                          {renderObjectFieldPDF(showLabel ? field.label : '', val, showLabel)}
                        </View>
                      );
                    }
                    if (field.isComplexObject) {
                      isFirstField = false;
                      return (
                        <View key={fIdx} wrap={sectionTitleForField ? false : undefined}>
                          {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                          {renderComplexObjectFieldPDF(showLabel ? field.label : '', val, showLabel)}
                        </View>
                      );
                    }
                    if (field.isRecursiveObject) {
                      if (isScalar(val) || isEmptyDeep(val)) return null;
                      const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
                      if (entries.length === 0) return null;
                      isFirstField = false;
                      const rows = countRows(val);
                      return (
                        <View key={fIdx} style={styles.fieldBox} wrap={sectionTitleForField ? false : (rows > 8 ? undefined : false)}>
                          {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                          {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
                          {entries.map(([k, v]) => renderObjectNodePDF(humanizeKey(k), v, `${field.key}-${k}`, 1))}
                        </View>
                      );
                    }
                    if (field.isObjectArray) {
                      const recs = Array.isArray(val) ? val.filter(r => hasVal(r?.recommendation)) : [];
                      if (recs.length === 0) return null;
                      isFirstField = false;
                      const groups = [];
                      recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
                      return (
                        <View key={fIdx} style={styles.fieldBox} wrap={sectionTitleForField ? false : (recs.length > 8 ? undefined : false)}>
                          {sectionTitleForField && <Text style={styles.sectionTitle}>{sectionTitleForField}</Text>}
                          {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
                          {groups.map((group, gIdx) => (
                            <View key={gIdx}>
                              {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
                              {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
                            </View>
                          ))}
                        </View>
                      );
                    }
                    if (field.isSentence) {
                      const result = renderSentenceField(showLabel ? field.label : '', fmtVal(val), sectionTitleForField, field.key, showLabel);
                      if (result) isFirstField = false;
                      return <View key={fIdx}>{result}</View>;
                    }
                    /* Default */
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
        ))}
      </Page>
    </Document>
  );
};

export default RheumatologicAssessmentDocumentPDFTemplate;
