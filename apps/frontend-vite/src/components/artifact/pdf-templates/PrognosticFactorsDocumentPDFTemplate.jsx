/**
 * PrognosticFactorsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — prognostic factors
 * Collection: prognostic_factors
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
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
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

/* humanizeKey: BloodPressure -> Blood Pressure; 24HourUrineProtein -> 24 Hour Urine Protein */
const humanizeKey = (key) => {
  if (!key || typeof key !== 'string') return String(key || '');
  if (/[A-Z]/.test(key.slice(1)) || /\d/.test(key)) {
    const spaced = key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .replace(/(\d)([a-zA-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
};

/* formatRecDate: lenient date label ("2027-02" stays partial) */
const formatRecDate = (dateValue) => {
  if (!dateValue) return '';
  const s = String(dateValue.$date || dateValue);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    try { const d = new Date(s); if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { /* fall through */ }
  }
  return s;
};

/* renderObjectFieldPDF: dynamic-key object {key: value} → humanized key + typed leaf, content-gated (Rule #74) */
const renderObjectFieldPDF = (label, obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const keys = Object.keys(obj).filter(k => hasVal(obj[k]));
  if (keys.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={keys.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {keys.map((k, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {humanizeKey(k)}: {safeString(fmtVal(obj[k]))}</Text>
      ))}
    </View>
  );
};

/* renderObjArrayFieldPDF: array-of-objects [{recommendation, date}] flattened readable (no [object Object]) */
const renderObjArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items)) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => {
        let itemStr;
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const rec = fmtVal(item.recommendation ?? item.text ?? '');
          const dt = item.date ? ` (${formatRecDate(item.date)})` : '';
          itemStr = `${rec}${dt}`;
        } else {
          itemStr = safeString(item);
        }
        return <Text key={i} style={styles.listItem}>{i + 1}. {itemStr}</Text>;
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
      {safeItems.map((item, i) => {
        const itemStr = typeof item === 'object' && item !== null
          ? `${item.type || 'Score'}: ${item.value || ''}${item.interpretation ? ` (${item.interpretation})` : ''}`
          : safeString(item);
        return <Text key={i} style={styles.listItem}>{i + 1}. {itemStr}</Text>;
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
      { key: 'type', label: 'Type', isSentence: true },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
  {
    title: 'Favorable Factors',
    fields: [
      { key: 'favorableFactors', label: 'Favorable Factors', isArray: true },
    ],
  },
  {
    title: 'Adverse Factors',
    fields: [
      { key: 'adverseFactors', label: 'Adverse Factors', isArray: true },
    ],
  },
  {
    title: 'Survival Estimates',
    fields: [
      { key: 'survivalEstimates.fiveYear', label: 'Five-Year Survival', isSentence: true, nested: true },
      { key: 'survivalEstimates.tenYear', label: 'Ten-Year Survival', isSentence: true, nested: true },
      { key: 'survivalEstimates.medianSurvival', label: 'Median Survival', isSentence: true, nested: true },
    ],
  },
  {
    title: 'Recurrence Risk',
    fields: [
      { key: 'recurrenceRisk', label: 'Recurrence Risk', isSentence: true },
    ],
  },
  {
    title: 'Prognostic Scores',
    fields: [
      { key: 'prognosticScores', label: 'Prognostic Scores', isArray: true },
    ],
  },
  {
    title: 'Molecular Subtype',
    fields: [
      { key: 'molecularSubtype', label: 'Subtype', isSentence: true },
      { key: 'molecularSubtypeMethodology', label: 'Methodology', isSentence: true },
    ],
  },
  {
    title: 'Results',
    fields: [
      { key: 'results', label: 'Results', isObject: true },
    ],
  },
  {
    title: 'Clinical Findings',
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
    fields: [
      { key: 'recommendations', label: 'Recommendations', isObjArray: true },
    ],
  },
];

/* helper to resolve nested field values */
const getNestedValue = (record, key) => {
  if (!key.includes('.')) return record[key];
  const parts = key.split('.');
  let val = record;
  for (const p of parts) { val = val?.[p]; }
  return val;
};

/* ======= COMPONENT ======= */
const PrognosticFactorsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.prognostic_factors) return Array.isArray(r.prognostic_factors) ? r.prognostic_factors : [r.prognostic_factors];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.prognostic_factors) return Array.isArray(dd.prognostic_factors) ? dd.prognostic_factors : [dd.prognostic_factors]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Prognostic Factors</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Prognostic Factors</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                <Text style={styles.recordTitle}>{record.molecularSubtype || `Prognostic Factors ${idx + 1}`}</Text>
                {record.date && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>
            </View>

            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const sectionFields = sectionConfig.fields;
              const hasAny = sectionFields.some(f => {
                const val = getNestedValue(record, f.key);
                return hasVal(val);
              });
              if (!hasAny) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {sectionFields.map((fieldConfig, fIdx) => {
                    const val = getNestedValue(record, fieldConfig.key);
                    if (!hasVal(val)) return null;

                    if (fieldConfig.isDate) return <View key={fIdx}>{renderDateFieldPDF(fieldConfig.label, val)}</View>;
                    if (fieldConfig.isArray) return <View key={fIdx}>{renderArrayFieldPDF(fieldConfig.label, val)}</View>;
                    if (fieldConfig.isObjArray) return <View key={fIdx}>{renderObjArrayFieldPDF(fieldConfig.label, val)}</View>;
                    if (fieldConfig.isObject) return <View key={fIdx}>{renderObjectFieldPDF(fieldConfig.label, val)}</View>;
                    if (fieldConfig.isSentence) return <View key={fIdx}>{renderSentenceSection(fieldConfig.label, val)}</View>;
                    return <View key={fIdx}>{renderFieldRow(fieldConfig.label, val)}</View>;
                  })}
                </View>
              );
            })}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrognosticFactorsDocumentPDFTemplate;
