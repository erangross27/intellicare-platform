/**
 * TableDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — generic table/fallback
 * Collection: table (generic)
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

/* ======= SKIP KEYS ======= */
const SKIP_KEYS = new Set([
  '_id', '__v', 'patientId', 'documentId', 'createdAt', 'updatedAt',
  'practiceId', 'doctorEdits', '_showAllSections', 'patient_id',
]);

const prettifyKey = (k) =>
  k.replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map((s) => s.trim()).filter((s) => s && !/^[;.,!?]+$/.test(s));
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

const isDateValue = (v) => {
  if (!v) return false;
  if (typeof v === 'object' && v.$date) return true;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(new Date(v).getTime())) return true;
  return false;
};

/* renderFieldRow */
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
  sentences.forEach((s) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach((ci) => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
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
        <Text key={i} style={styles.listItem}>{i + 1}. {typeof item === 'object' ? JSON.stringify(item) : safeString(item)}</Text>
      ))}
    </View>
  );
};

/* renderObjectField */
const renderObjectFieldPDF = (label, obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([k]) => !SKIP_KEYS.has(k));
  if (entries.length === 0) return null;

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {entries.map(([k, v], i) => (
        <Text key={i} style={styles.listItem}>{prettifyKey(k)}: {typeof v === 'object' ? JSON.stringify(v) : safeString(v)}</Text>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const TableDocumentPDFTemplate = ({ document: data, category }) => {
  const collectionName = category || 'table';
  const displayTitle = prettifyKey(collectionName);

  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap((r) => {
      if (r && r[collectionName]) {
        const inner = r[collectionName];
        return Array.isArray(inner) ? inner : [inner];
      }
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd[collectionName]) return Array.isArray(dd[collectionName]) ? dd[collectionName] : [dd[collectionName]];
        return [dd];
      }
      return [r];
    });
    return arr.filter((r) => r && typeof r === 'object');
  }, [data, collectionName]);

  /* Dynamic field discovery */
  const { sectionOrder, sectionFields, sectionTitles, fieldLabels } = React.useMemo(() => {
    const fieldSet = new Set();
    records.forEach((r) => Object.keys(r).forEach((k) => { if (!SKIP_KEYS.has(k)) fieldSet.add(k); }));
    const allF = [...fieldSet];

    const primitives = [];
    const arrays = [];
    const objects = [];

    allF.forEach((f) => {
      let sample = null;
      for (const r of records) { if (r[f] !== undefined && r[f] !== null) { sample = r[f]; break; } }
      if (sample === null) { primitives.push(f); return; }
      if (Array.isArray(sample)) { arrays.push(f); return; }
      if (typeof sample === 'object' && !sample.$date) { objects.push(f); return; }
      primitives.push(f);
    });

    const secOrder = [];
    const secFields = {};
    const secTitles = {};
    const fLabels = {};

    if (primitives.length > 0) {
      secOrder.push('general');
      secFields['general'] = primitives;
      secTitles['general'] = 'General Information';
    }

    arrays.forEach((f) => {
      const sid = `arr-${f}`;
      secOrder.push(sid);
      secFields[sid] = [f];
      secTitles[sid] = prettifyKey(f);
    });

    objects.forEach((f) => {
      const sid = `obj-${f}`;
      secOrder.push(sid);
      secFields[sid] = [f];
      secTitles[sid] = prettifyKey(f);
    });

    allF.forEach((f) => { fLabels[f] = prettifyKey(f); });

    return { sectionOrder: secOrder, sectionFields: secFields, sectionTitles: secTitles, fieldLabels: fLabels };
  }, [records]);

  /* Render a single field */
  const renderFieldPDF = (fieldKey, value, label) => {
    if (!hasVal(value)) return null;
    if (isDateValue(value)) return <View key={fieldKey}>{renderDateFieldPDF(label, value)}</View>;
    if (Array.isArray(value)) return <View key={fieldKey}>{renderArrayFieldPDF(label, value)}</View>;
    if (typeof value === 'object' && !value.$date) return <View key={fieldKey}>{renderObjectFieldPDF(label, value)}</View>;
    if (typeof value === 'string') {
      const sentences = splitBySentence(value);
      if (sentences.length > 1) return <View key={fieldKey}>{renderSentenceSection(label, value)}</View>;
    }
    return <View key={fieldKey}>{renderFieldRow(label, value)}</View>;
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>{displayTitle}</Text>
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
          <Text style={styles.documentTitle}>{displayTitle}</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {record.name || record.title || `${displayTitle} ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {sectionOrder.map((sid, sIdx) => {
              const fields = sectionFields[sid] || [];
              const hasAnyVal = fields.some((f) => hasVal(record[f]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  <Text style={styles.sectionTitle}>{sectionTitles[sid]}</Text>
                  {fields.map((f) => renderFieldPDF(f, record[f], fieldLabels[f] || prettifyKey(f)))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TableDocumentPDFTemplate;
