/**
 * ExerciseProgramDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors ExerciseProgramDocument.jsx sections/labels exactly
 * (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: exercise_program.
 * react-pdf: wrap is BOOLEAN only; each section is one wrap-glued View so its title never orphans.
 * Sentence fields split on [.;] + aggressive comma-split (labeled AND unlabeled) + numbered. Title /
 * section title / field label each get a borderBottom underline (no boxes). status → enumCanonical.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.5 },
  listItem: { fontSize: 14, color: '#000000', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  nestedGroup: { marginLeft: 10, marginTop: 2 },
  noData: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      const rest = text.slice(i + 1);
      const nextChar = rest.charAt(0);
      const restTrim = rest.replace(/^\s+/, '');
      if ((nextChar && /\d/.test(nextChar)) || /^(and|or|then)\b/i.test(restTrim) || /\b(and|or)$/i.test(current.trim())) {
        current += ch;
      } else {
        const t = current.trim(); if (t) result.push(t); current = '';
      }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* status → record-status catalog (mirror JSX enumCanonical). Stored 'active' → 'Active'. */
const STATUS_OPTIONS = ['Active', 'Not Active', 'Completed'];
const enumCanonical = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const hit = STATUS_OPTIONS.find(o => o.toLowerCase() === s.toLowerCase());
  return hit || (s.charAt(0).toUpperCase() + s.slice(1));
};

/* ═══ OBJECT (results) HELPERS ═══ */
const KEY_OVERRIDES = {};
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
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* recursive object node: bold sub-label heading + plain value line below (stacked, never "key: value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={styles.nestedSubtitle}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={styles.nestedSubtitle}>{label}</Text> : null}
      <View style={label ? styles.nestedGroup : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* renderObjectFieldPDF: each top-level entry is ONE wrap-gated View → returns an ARRAY of Views. */
const renderObjectFieldPDF = (label, val) => {
  if (!hasVal(val) || isScalar(val)) return null;
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return entries.map(([k, v], i) => {
    const rows = countRows(v);
    return (
      <View key={`results-${k}`} style={styles.fieldBox} wrap={rows > 8}>
        {i === 0 && label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
      </View>
    );
  });
};

/* buildRows: sentence → numbered rows (parseLabel sub-heading + aggressive comma-split). */
const buildRows = (items) => {
  const rows = []; let n = 1;
  items.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) { rows.push({ type: 'sub', text: safeString(parsed.label) }); parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 2) { parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    }
  });
  return rows;
};

const renderRowsBlock = (label, rows, key) => {
  if (rows.length === 0) return null;
  return (
    <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((row, i) => row.type === 'sub'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* renderRecommendationsPDF: array of objects grouped by date → date sub-heading + numbered items. */
const renderRecommendationsPDF = (label, items, key) => {
  const safeItems = (Array.isArray(items) ? items : []).filter(i => i && typeof i === 'object');
  if (safeItems.length === 0) return null;
  const grouped = {};
  safeItems.forEach((item) => { const dk = item.date || 'No Date'; (grouped[dk] = grouped[dk] || []).push(item); });
  const rows = [];
  Object.entries(grouped).forEach(([dk, recs]) => {
    rows.push({ type: 'sub', text: dk !== 'No Date' ? formatDate(dk) : 'No Date' });
    recs.forEach((rec, i) => { rows.push({ type: 'item', text: safeString(rec.recommendation || ''), num: i + 1 }); });
  });
  return (
    <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((row, i) => row.type === 'sub'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'Record Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'provider', label: 'Provider' },
    { key: 'facility', label: 'Facility' },
    { key: 'status', label: 'Status', type: 'enum' },
  ] },
  { title: 'Exercise Details', fields: [
    { key: 'type', label: 'Type', type: 'sentence' },
    { key: 'frequency', label: 'Frequency', type: 'sentence' },
    { key: 'duration', label: 'Duration', type: 'sentence' },
    { key: 'intensity', label: 'Intensity', type: 'sentence' },
    { key: 'purpose', label: 'Purpose', type: 'sentence' },
  ] },
  { title: 'Findings', fields: [
    { key: 'findings', label: 'Findings', type: 'sentence' },
  ] },
  { title: 'Assessment', fields: [
    { key: 'assessment', label: 'Assessment', type: 'sentence' },
  ] },
  { title: 'Plan', fields: [
    { key: 'plan', label: 'Plan', type: 'sentence' },
  ] },
  { title: 'Recommendations', fields: [
    { key: 'recommendations', label: 'Recommendations', type: 'recArray' },
  ] },
  { title: 'Results', fields: [
    { key: 'results', label: 'Results', type: 'object' },
  ] },
  { title: 'Notes', fields: [
    { key: 'notes', label: 'Notes', type: 'sentence' },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (f.type === 'recArray') return Array.isArray(v) && v.filter(i => i && typeof i === 'object').length > 0;
  if (f.type === 'object') return hasVal(v) && !isScalar(v) && Object.values(v).some(x => !isEmptyDeep(x));
  return hasVal(v);
};

/* renderField: one wrap-glued View (or array of Views for object) per field. */
const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  const showLabel = (field.label || '').toLowerCase() !== (sectionTitle || '').toLowerCase();
  const lbl = showLabel ? field.label : null;
  if (field.type === 'sentence') return renderRowsBlock(lbl, buildRows(splitBySentence(fmtVal(val))), key);
  if (field.type === 'recArray') return renderRecommendationsPDF(lbl, val, key);
  if (field.type === 'object') return renderObjectFieldPDF(lbl, val);

  const display = field.type === 'date' ? formatDate(val) : field.type === 'enum' ? enumCanonical(val) : safeString(fmtVal(val));
  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

const ExerciseProgramDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.exercise_program) return Array.isArray(r.exercise_program) ? r.exercise_program : [r.exercise_program];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.exercise_program) return Array.isArray(dd.exercise_program) ? dd.exercise_program : [dd.exercise_program]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Exercise Program</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Exercise Program</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>Exercise Program {idx + 1}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const present = cfg.fields.filter(f => isPresent(record, f));
              if (present.length === 0) return null;

              /* OBJECT-only section: glue the title with the FIRST object entry View (Rule #74). */
              if (present.length === 1 && present[0].type === 'object') {
                const objNodes = renderObjectFieldPDF(
                  present[0].label.toLowerCase() !== cfg.title.toLowerCase() ? present[0].label : null,
                  record[present[0].key]
                );
                if (!objNodes || objNodes.length === 0) return null;
                return (
                  <View key={sIdx} style={styles.section}>
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>{cfg.title}</Text>
                      {objNodes[0]}
                    </View>
                    {objNodes.slice(1)}
                  </View>
                );
              }

              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(record, present[0], cfg.title, 0)}
                  </View>
                  {present.slice(1).map((field, i) => renderField(record, field, cfg.title, i + 1))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default ExerciseProgramDocumentPDFTemplate;
