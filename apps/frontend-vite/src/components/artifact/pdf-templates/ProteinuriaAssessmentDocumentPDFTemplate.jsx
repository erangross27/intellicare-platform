/**
 * ProteinuriaAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — proteinuria assessment
 * Collection: proteinuria_assessment
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
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1f2937', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#cccccc', borderLeftStyle: 'solid' },
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

/* ======= OBJECT (recursive) HELPERS ======= */
const KEY_OVERRIDES = { uacr: 'UACR', upcr: 'UPCR', rbc: 'RBC', wbc: 'WBC', ph: 'pH' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* recursive object node: label = bold heading; value = plain line below (NO inline "Label: value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
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
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic (Rule #74) */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* renderObjectFieldPDF: results (object) — each top-level key its own wrap-gated View */
const renderObjectFieldPDF = (val) => {
  if (isEmptyDeep(val) || isScalar(val)) return null;
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => {
    const rows = countRows(v);
    return (
      <View key={k} style={styles.fieldBox} wrap={rows > 8 ? undefined : false}>
        {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
      </View>
    );
  });
};

/* renderRecommendationsPDF: array of {recommendation, date}, date-grouped, numbered */
const renderRecommendationsPDF = (val) => {
  const recs = Array.isArray(val) ? val : [];
  if (recs.length === 0) return null;
  const groups = [];
  recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
  return (
    <View style={styles.fieldBox} wrap={recs.length > 8 ? undefined : false}>
      {groups.map((group, gIdx) => (
        <View key={gIdx}>
          {group.date ? <Text style={styles.nestedSubtitle}>{group.date}</Text> : null}
          {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
        </View>
      ))}
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

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'General Information',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
  {
    title: 'Proteinuria Measurements',
    fields: [
      { key: 'uacr', label: 'UACR', isSentence: true },
      { key: 'uacrCategory', label: 'UACR Category', isSentence: true },
      { key: 'upcr', label: 'UPCR', isSentence: true },
      { key: 'twentyFourHourProtein', label: '24-Hour Protein', isSentence: true },
    ],
  },
  {
    title: 'Protein Trend',
    custom: 'proteinTrend',
  },
  {
    title: 'Urinalysis Findings',
    fields: [
      { key: 'hematuria', label: 'Hematuria' },
      { key: 'hematuriaType', label: 'Hematuria Type', isSentence: true },
      { key: 'rbcCasts', label: 'RBC Casts' },
    ],
  },
  {
    title: 'Urine Electrophoresis',
    custom: 'urineElectrophoresis',
  },
  {
    title: 'Results',
    custom: 'results',
  },
  {
    title: 'Findings & Assessment',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
      { key: 'assessment', label: 'Assessment', isSentence: true },
    ],
  },
  {
    title: 'Plan & Notes',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
  {
    title: 'Recommendations',
    custom: 'recommendations',
  },
];

/* ======= COMPONENT ======= */
const ProteinuriaAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.proteinuria_assessment) return Array.isArray(r.proteinuria_assessment) ? r.proteinuria_assessment : [r.proteinuria_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.proteinuria_assessment) return Array.isArray(dd.proteinuria_assessment) ? dd.proteinuria_assessment : [dd.proteinuria_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Proteinuria Assessment</Text>
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
          <Text style={styles.documentTitle}>Proteinuria Assessment</Text>
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
                {record.provider || `Proteinuria Assessment ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              /* Custom: Protein Trend */
              if (sectionConfig.custom === 'proteinTrend') {
                if (!record.proteinTrend || !Array.isArray(record.proteinTrend) || record.proteinTrend.length === 0) return null;
                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {record.proteinTrend.map((item, tIdx) => (
                      <View key={tIdx} style={styles.fieldBox}>
                        <Text style={styles.fieldLabel}>{formatDate(item.date) || `Entry ${tIdx + 1}`}</Text>
                        <Text style={styles.fieldValue}>
                          {item.value}{item.unit ? ` ${item.unit}` : ''}{item.type ? ` (${item.type})` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              }

              /* Custom: Urine Electrophoresis */
              if (sectionConfig.custom === 'urineElectrophoresis') {
                if (!record.urineElectrophoresis || typeof record.urineElectrophoresis !== 'object' || Object.keys(record.urineElectrophoresis).length === 0) return null;
                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {Object.entries(record.urineElectrophoresis).map(([key, value], eIdx) => (
                      <View key={eIdx} style={styles.fieldBox}>
                        <Text style={styles.fieldLabel}>{key.toUpperCase()}</Text>
                        <Text style={styles.fieldValue}>{String(value)}</Text>
                      </View>
                    ))}
                  </View>
                );
              }

              /* Custom: Results (recursive object) */
              if (sectionConfig.custom === 'results') {
                if (!hasVal(record.results) || isScalar(record.results)) return null;
                const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
                if (entries.length === 0) return null;
                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderObjectFieldPDF(record.results)}
                  </View>
                );
              }

              /* Custom: Recommendations (array of {recommendation, date}) */
              if (sectionConfig.custom === 'recommendations') {
                if (!Array.isArray(record.recommendations) || record.recommendations.filter(r => hasVal(r)).length === 0) return null;
                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderRecommendationsPDF(record.recommendations)}
                  </View>
                );
              }

              /* Standard fields */
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;

                    if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val)}</View>;
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

export default ProteinuriaAssessmentDocumentPDFTemplate;
