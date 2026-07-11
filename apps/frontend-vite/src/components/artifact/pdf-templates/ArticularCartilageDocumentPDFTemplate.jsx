/**
 * ArticularCartilageDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — articular cartilage
 * Collection: articular_cartilage
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 13, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2 },
  nested: { marginLeft: 10 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* dynamic-object key humanizer (matches JSX) */
const KEY_OVERRIDES = { bp: 'BP', sbp: 'SBP', dbp: 'DBP', mri: 'MRI', icrs: 'ICRS', xray: 'X-Ray', ct: 'CT' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

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

/* splitClauses: split on BOTH '. ' and '; ' (paren-aware, abbreviation/decimal-safe). Mirrors the JSX
   so a mixed field like Notes ("A; B; C. D") renders one row per clause. */
const ABBREV_RE = /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/;
const splitClauses = (text) => {
  if (!text || typeof text !== 'string') return [];
  const out = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
    if ((ch === '.' || ch === ';') && depth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
      if (ch === '.' && ABBREV_RE.test(current.trim())) { current += ch; continue; }
      const t = current.trim();
      let j = i + 1; while (j < text.length && /\s/.test(text[j])) j++;
      if (t) out.push(t);
      current = ''; i = j - 1;
      continue;
    }
    current += ch;
  }
  const t = current.trim();
  if (t) out.push(t.replace(/[;.]+$/, ''));
  return out;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return splitClauses(text).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      // don't split before a year (date) OR before a trailing "and"/"or" conjunction —
      // "..., and tibial plateaus" / "..., or delamination" relate to the preceding item, keep them joined
      if (/^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: split narrative on '. ' AND '; ' into clauses, then comma-split each clause
   (and/or-guarded — a list-tail conjunction "..., and X" / "..., or Y" stays joined to its item).
   Labeled clause → nested-subtitle + its comma items. A single bare scalar → plain value (no numbering). */
const renderSentenceSection = (label, text, showLabel) => {
  if (!hasVal(text)) return null;
  const strVal = fmtVal(text);
  const clauses = splitBySentence(strVal);
  if (clauses.length === 0) return null;

  const rows = [];
  let n = 1;
  clauses.forEach(clause => {
    const parsed = parseLabel(clause);
    if (parsed.isLabeled) {
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      splitByComma(parsed.value).forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
    } else {
      splitByComma(clause).forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
    }
  });

  /* single bare scalar (one clause, one item, no label) → plain value, no numbering */
  if (rows.length === 1 && rows[0].type === 'item') {
    return (
      <View style={styles.fieldBox} wrap={false}>
        {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{rows[0].text}</Text>
      </View>
    );
  }

  /* wrap={undefined} === false on @react-pdf v4 — use true for long lists so they flow across pages */
  const wrapProp = rows.length > 8 ? true : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
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
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* recursive object node: label = bold heading; value = plain line below */
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
  if (Array.isArray(value)) {
    const items = value.filter(v => !isEmptyDeep(v));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <View style={label ? styles.nested : undefined}>{items.map((v, i) => renderObjectNode('', v, `${keyPath}-${i}`, depth + 1))}</View>
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

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* renderObjectField: dynamic-key root object (empty-{} guarded), wrap-gated by row count */
const renderObjectFieldPDF = (label, value, showLabel) => {
  if (isEmptyDeep(value) || isScalar(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  const wrapProp = countRows(value) > 8 ? undefined : false;
  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${label}-${k}`, 1))}
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
      { key: 'type', label: 'Type', isSentence: true },
    ],
  },
  {
    title: 'Cartilage Details',
    fields: [
      { key: 'grade', label: 'Grade', isSentence: true },
      { key: 'size', label: 'Size', isSentence: true },
      { key: 'treatment', label: 'Treatment', isSentence: true },
    ],
  },
  {
    title: 'Location',
    fields: [
      { key: 'location', label: 'Location', isArray: true },
    ],
  },
  {
    title: 'Findings',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
    ],
  },
  {
    title: 'Assessment',
    fields: [
      { key: 'assessment', label: 'Assessment', isSentence: true },
    ],
  },
  {
    title: 'Plan',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
      { key: 'recommendations', label: 'Recommendations', isArray: true },
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
const ArticularCartilageDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.articular_cartilage) return Array.isArray(r.articular_cartilage) ? r.articular_cartilage : [r.articular_cartilage];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.articular_cartilage) return Array.isArray(dd.articular_cartilage) ? dd.articular_cartilage : [dd.articular_cartilage]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Articular Cartilage</Text>
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
          <Text style={styles.documentTitle}>Articular Cartilage</Text>
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
                {`Articular Cartilage ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => hasVal(record[f.key]));
              if (presentFields.length === 0) return null;

              const renderField = (field) => {
                const val = record[field.key];
                const showLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                if (field.isDate) return renderDateFieldPDF(field.label, val, showLabel);
                if (field.isObject) return renderObjectFieldPDF(field.label, val, showLabel);
                if (field.isArray) return renderArrayFieldPDF(field.label, val, showLabel);
                if (field.isSentence) return renderSentenceSection(field.label, val, showLabel);
                return renderFieldRow(field.label, val, showLabel);
              };

              return (
                <View key={sIdx} style={styles.section}>
                  {/* Title + first field together — prevents orphaned titles */}
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderField(presentFields[0])}
                  </View>
                  {/* Remaining fields */}
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

export default ArticularCartilageDocumentPDFTemplate;
