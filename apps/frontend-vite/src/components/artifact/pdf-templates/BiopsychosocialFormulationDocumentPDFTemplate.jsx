/**
 * BiopsychosocialFormulationDocumentPDFTemplate.jsx
 * Helvetica font, 20/14/12pt hierarchy, numbered items, no label:value
 * Conditional wrap pattern, no page footers
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  nestedBlock: { marginBottom: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#cccccc', paddingTop: 4, paddingBottom: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const keyToLabel = (key) => key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
const safeArray = (val) => Array.isArray(val) ? val.filter(Boolean) : [];
const isScalar = (v) => v === null || v === undefined || typeof v !== 'object';
const isEmptyDeep = (v) => { if (v === null || v === undefined || v === '') return true; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const countLeaves = (v) => { if (isEmptyDeep(v)) return 0; if (isScalar(v)) return 1; if (Array.isArray(v)) return v.reduce((n, x) => n + countLeaves(x), 0) + 1; return Object.entries(v).filter(([k]) => k !== '_id').reduce((n, [, vv]) => n + countLeaves(vv), 0) + 1; };
// Built-in Helvetica lacks → ≥ ≤ µ × etc.; a missing glyph renders as garbage AND eats the next space — ASCII-map.
const pdfSafe = (s) => String(s == null ? '' : s).replace(/→/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/µ/g, 'u').replace(/μ/g, 'u').replace(/±/g, '+/-').replace(/×/g, 'x').replace(/÷/g, '/').replace(/°/g, ' deg').replace(/—/g, '-').replace(/–/g, '-');
// IDENTICAL to the JSX splitByComma — paren-aware; depth-0 comma splits UNLESS between two digits
// (1,500), before a 4-digit year, or before whole-word and/or. Read-only here → returns string[].
const splitByComma = (text) => {
  if (text === null || text === undefined) return [];
  const s = String(text); const out = []; let buf = '', depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') { depth++; buf += ch; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { if (depth > 0) depth--; buf += ch; continue; }
    if (ch === ',' && depth === 0) {
      const prev = s[i - 1] || ''; const rest = s.slice(i + 1).replace(/^\s+/, ''); const next = rest[0] || '';
      if ((/\d/.test(prev) && /\d/.test(next)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)) { buf += ch; continue; }
      const t = buf.trim(); if (t) out.push(t); buf = ''; continue;
    }
    buf += ch;
  }
  const t = buf.trim(); if (t) out.push(t);
  return out;
};

const BiopsychosocialFormulationDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.biopsychosocial_formulation) return Array.isArray(r.biopsychosocial_formulation) ? r.biopsychosocial_formulation : [r.biopsychosocial_formulation]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.biopsychosocial_formulation) return Array.isArray(dd.biopsychosocial_formulation) ? dd.biopsychosocial_formulation : [dd.biopsychosocial_formulation]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // Each sub-field = one atomic nestedBlock (wrap={false}) so it never splits mid-list. String sub-fields
  // are comma-split (mirrors JSX). When the whole section is tall (>8 rows) the title is GLUED to the
  // first block in a wrap={false} sub-View and the rest flow → boolean wrap, orphan-proof (v4 6a3cda8c).
  const renderMixedObject = (title, obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj).filter(([k, v]) => k !== '_id' && v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0));
    if (entries.length === 0) return null;
    const blocks = entries.map(([key, value], i) => {
      const items = (Array.isArray(value) ? value.filter(Boolean).map(String) : splitByComma(String(value))).map(pdfSafe);
      return (<View key={i} style={styles.nestedBlock} wrap={false}><Text style={styles.subSectionTitle}>{keyToLabel(key)}</Text>{items.map((item, j) => <Text key={j} style={styles.listItem}>{j + 1}. {item}</Text>)}</View>);
    });
    const totalItems = entries.reduce((n, [, v]) => n + (Array.isArray(v) ? v.filter(Boolean).length + 1 : splitByComma(String(v)).length + 1), 0);
    if (totalItems <= 8) return (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{blocks}</View>);
    return (<View style={styles.fieldContainer} wrap={true}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{blocks[0]}</View>{blocks.slice(1)}</View>);
  };

  const renderArray = (title, items) => {
    const safe = safeArray(items).map(pdfSafe);
    if (safe.length === 0) return null;
    if (safe.length <= 8) return (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{safe.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</View>);
    return (<View style={styles.fieldContainer} wrap={true}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.listItem}>1. {safe[0]}</Text></View>{safe.slice(1).map((item, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {item}</Text>)}</View>);
  };

  const renderText = (title, text) => {
    if (!text || !String(text).trim()) return null;
    return (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.listItem}>{pdfSafe(text)}</Text></View>);
  };

  // Recommendations — array of { recommendation, date } objects (also tolerates legacy string items)
  const renderRecommendations = (title, items) => {
    const arr = Array.isArray(items) ? items.filter(it => !isEmptyDeep(it)) : [];
    if (arr.length === 0) return null;
    const rows = arr.map(it => pdfSafe(isScalar(it) ? String(it) : [it.recommendation, it.date].filter(Boolean).join(' — ')));
    if (rows.length <= 8) return (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{rows.map((r, i) => <Text key={i} style={styles.listItem}>{i + 1}. {r}</Text>)}</View>);
    return (<View style={styles.fieldContainer} wrap={true}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.listItem}>1. {rows[0]}</Text></View>{rows.slice(1).map((r, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {r}</Text>)}</View>);
  };

  // Recursive grayscale renderer for arbitrary nested object (results). Hide-empty at every level.
  const renderResultsNode = (value, label, depth, keyHint) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return (<View key={keyHint} style={styles.nestedBlock} wrap={false}><Text style={styles.subSectionTitle}>{label}</Text><Text style={styles.listItem}>{pdfSafe(value)}</Text></View>);
    if (Array.isArray(value)) {
      const items = value.map((it, i) => ({ it, i })).filter(({ it }) => !isEmptyDeep(it));
      if (items.length === 0) return null;
      return (<View key={keyHint} style={styles.nestedBlock} wrap={false}><Text style={styles.subSectionTitle}>{label}</Text>{items.map(({ it, i }) => isScalar(it) ? <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(it)}</Text> : renderResultsNode(it, `${label} ${i + 1}`, depth + 1, `${keyHint}-${i}`))}</View>);
    }
    const entries = Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (<View key={keyHint} style={styles.nestedBlock}><Text style={styles.subSectionTitle}>{label}</Text>{entries.map(([k, v], i) => renderResultsNode(v, keyToLabel(k), depth + 1, `${keyHint}-${k}`))}</View>);
  };

  const renderResults = (title, obj) => {
    if (isEmptyDeep(obj) || isScalar(obj)) return null;
    const entries = Object.entries(obj).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const totalItems = entries.reduce((n, [, v]) => n + countLeaves(v), 0);
    const blocks = entries.map(([k, v]) => renderResultsNode(v, keyToLabel(k), 0, `res-${k}`));
    if (totalItems <= 8) return (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{blocks}</View>);
    return (<View style={styles.fieldContainer} wrap={true}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{blocks[0]}</View>{blocks.slice(1)}</View>);
  };

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Biopsychosocial Formulation</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Biopsychosocial Formulation</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Biopsychosocial Formulation ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}{record.provider && <Text style={styles.recordMeta}>{pdfSafe(record.provider)}</Text>}{record.facility && <Text style={styles.recordMeta}>{pdfSafe(record.facility)}</Text>}</View>

            {renderMixedObject('Biological Factors', record.biologicalFactors)}
            {renderMixedObject('Psychological Factors', record.psychologicalFactors)}
            {renderMixedObject('Social Factors', record.socialFactors)}
            {renderArray('Strengths', record.strengths)}
            {renderArray('Vulnerabilities', record.vulnerabilities)}
            {renderArray('Perpetuating Factors', record.perpetuatingFactors)}
            {renderArray('Protective Factors', record.protectiveFactors)}
            {renderText('Integrated Formulation', record.integratedFormulation)}
            {renderText('Findings', record.findings)}
            {renderText('Assessment', record.assessment)}
            {renderText('Plan', record.plan)}
            {renderRecommendations('Recommendations', record.recommendations)}
            {renderResults('Results', record.results)}
            {renderText('Notes', record.notes)}
            {renderText('Status', record.status)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BiopsychosocialFormulationDocumentPDFTemplate;
