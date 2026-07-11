/**
 * PostoperativeOrdersDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER size — postoperative orders
 * Collection: postoperative_orders
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const KEY_OVERRIDES = { cd4: 'CD4', hgb: 'Hgb', wbc: 'WBC', inr: 'INR', bun: 'BUN', ekg: 'EKG', ct: 'CT', mri: 'MRI', bmp: 'BMP', cbc: 'CBC', id: 'ID' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[String(key).toLowerCase()]) return KEY_OVERRIDES[String(key).toLowerCase()];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 20, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 1 },
  nested: { marginLeft: 10 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#666666', textAlign: 'center', marginTop: 40 },
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

/* Helvetica has no glyph for U+00D7 (multiplication sign) — scrub to 'x' */
const safeString = (val) => {
  let s;
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s.replace(/×/g, 'x');
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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      const nextIsSpace = /\s/.test(text[i + 1] || '');
      const nextIsYear = /^\s*\d{4}\b/.test(text.slice(i + 1));
      if (nextIsSpace && !nextIsYear) { const t = current.trim(); if (t) result.push(t); current = ''; }
      else { current += ch; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* STRING fields whose unlabeled >=3-item comma value splits into numbered rows (mirrors the JSX). */
const COMMA_SPLIT_FIELDS = ['activity'];

/* renderFieldRow: bare label + value (no self-wrap — the section glue owns wrap) */
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

/* renderSentenceSection: parseLabel + comma-split (bare, no self-wrap) */
const renderSentenceSection = (label, text, commaSplit) => {
  if (!hasVal(text)) return null;
  const strVal = fmtVal(text);
  const sentences = splitBySentence(strVal);
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  if (commaSplit && sentences.length === 1 && !parseLabel(strVal).isLabeled && splitByComma(strVal).length >= 3) {
    splitByComma(strVal).forEach(p => { rows.push({ type: 'item', text: safeString(p), num: n++ }); });
  } else {
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
  }

  return (
    <View style={styles.fieldBox}>
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

/* ======= OBJECT (dynamic-key) RENDER ======= */
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

/* recursive object node: label = bold heading; value = plain line below (no inline "Label: value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 1 ? styles.subLabel : styles.nestedSubtitle;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={styles.nested}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* renderObjectFieldPDF: one bare View per top-level key (no self-wrap — glue owns wrap) */
const renderObjectFieldPDF = (label, value, showLabel) => {
  if (!hasVal(value) || isScalar(value)) return [];
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  return entries.map(([k, v], i) => (
    <View key={`results-${k}`} style={styles.fieldBox}>
      {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
    </View>
  ));
};

/* renderArrayField: numbered items (labeled items kept whole/numbered — leading number shields side-by-side) */
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => {
        if (typeof item === 'object' && item !== null) {
          const recText = item.recommendation || item.text || JSON.stringify(item);
          const datePrefix = item.date ? `${formatDate(item.date)} - ` : '';
          return <Text key={i} style={styles.listItem}>{i + 1}. {datePrefix}{safeString(recText)}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>;
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
      { key: 'type', label: 'Type', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
  {
    title: 'Diet & Activity',
    fields: [
      { key: 'diet', label: 'Diet', isSentence: true },
      { key: 'activity', label: 'Activity', isSentence: true, commaSplit: true },
    ],
  },
  {
    title: 'Medications',
    fields: [
      { key: 'painManagement', label: 'Pain Management', isArray: true },
      { key: 'antibiotics', label: 'Antibiotics', isArray: true },
      { key: 'prophylaxis', label: 'Prophylaxis', isArray: true },
    ],
  },
  {
    title: 'Monitoring & Instructions',
    fields: [
      { key: 'monitoring', label: 'Monitoring', isArray: true },
      { key: 'specialInstructions', label: 'Special Instructions', isArray: true },
    ],
  },
  {
    title: 'Discharge Criteria',
    fields: [
      { key: 'dischargeHome', label: 'Discharge Home', isSentence: true },
    ],
  },
  {
    title: 'Clinical Notes',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
      { key: 'assessment', label: 'Assessment', isSentence: true },
      { key: 'plan', label: 'Plan', isSentence: true },
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
  {
    title: 'Recommendations & Results',
    fields: [
      { key: 'recommendations', label: 'Recommendations', isArray: true },
      { key: 'results', label: 'Results', isObject: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const PostoperativeOrdersDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.postoperative_orders) return Array.isArray(r.postoperative_orders) ? r.postoperative_orders : [r.postoperative_orders];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.postoperative_orders) return Array.isArray(dd.postoperative_orders) ? dd.postoperative_orders : [dd.postoperative_orders]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Postoperative Orders</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Postoperative Orders</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Postoperative Orders {index + 1}</Text>
            </View>

            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const elements = [];
              sectionConfig.fields.forEach((field, fIdx) => {
                const val = record[field.key];
                if (!hasVal(val)) return;
                if (field.isObject) {
                  renderObjectFieldPDF(field.label, val, true).forEach((el, i) => elements.push(<React.Fragment key={`o-${fIdx}-${i}`}>{el}</React.Fragment>));
                  return;
                }
                let el = null;
                if (field.isDate) el = renderDateFieldPDF(field.label, val);
                else if (field.isArray) el = renderArrayFieldPDF(field.label, val);
                else if (field.isSentence) el = renderSentenceSection(field.label, val, field.commaSplit);
                else el = renderFieldRow(field.label, val);
                if (el) elements.push(<React.Fragment key={`f-${fIdx}`}>{el}</React.Fragment>);
              });
              if (elements.length === 0) return null;
              const [first, ...rest] = elements;

              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {first}
                  </View>
                  {rest}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PostoperativeOrdersDocumentPDFTemplate;
