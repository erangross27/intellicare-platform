/**
 * EegReportsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — sentence/parseLabel/comma-split.
 * Collection: eeg_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { paddingBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 3, paddingLeft: 8, color: '#000000' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => String(v || '');

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'":-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// Parenthesis-aware + canonical guards (memory 6a46180d): no-space comma, ", and/or …", "… and/or ," stay joined.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const next = text[i + 1];
      if (next && next !== ' ') { current += ch; continue; }
      if (/^(and|or)\b/i.test(text.slice(i + 1).replace(/^\s+/, ''))) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* buildValueRows: decompose a narrative VALUE into rows — split by sentence, then LABELED sentences
   (≥2 comma items) → subtitle (restart numbering) + rows; UNLABELED sentences → comma-split only at
   ≥3 (natural-grammar guard) with a continuing counter. Mirrors the JSX renderValueLeaves exactly. */
const buildValueRows = (text) => {
  const rows = []; let n = 1;
  const strip = (x) => x.replace(/[;.]+$/, '').trim();
  splitBySentence(fmtVal(text)).forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = (parts.length >= 2 ? parts : [parsed.value]).map(strip);
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(it), num: m++ }));
    } else {
      const parts = splitByComma(s);
      const items = (parts.length >= 2 ? parts : [s]).map(strip);
      items.forEach(it => rows.push({ type: 'item', text: safeString(it), num: n++ }));
    }
  });
  return rows;
};

/* renderSentenceSection: section title + sentence→(labeled/comma) leaf rows (box-free) */
const renderSentenceSection = (title, text) => {
  if (!hasVal(text)) return null;
  const rows = buildValueRows(text);
  if (rows.length === 0) return null;
  return (
    <View style={styles.section} wrap={rows.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row, i) => row.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* renderArraySection: each item's label → subtitle, value decomposed like a narrative (box-free) */
const renderArraySection = (title, arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const rows = [];
  arr.forEach(item => {
    const text = fmtVal(item);
    if (!text.trim()) return;
    const parsed = parseLabel(text);
    if (parsed.isLabeled) {
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      buildValueRows(parsed.value).forEach(r => rows.push(r));
    } else {
      buildValueRows(text).forEach(r => rows.push(r));
    }
  });
  if (rows.length === 0) return null;
  return (
    <View style={styles.section} wrap={rows.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row, i) => row.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

const EegReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.eeg_reports) return Array.isArray(r.eeg_reports) ? r.eeg_reports : [r.eeg_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.eeg_reports) return Array.isArray(dd.eeg_reports) ? dd.eeg_reports : [dd.eeg_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>EEG Reports</Text></View>
        <Text style={styles.emptyState}>No records available</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>EEG Reports</Text></View>
        {records.map((record, idx) => {
          const sessionFields = [
            ['date', record.date],
            ['neurologist', record.neurologist],
          ].filter(([, v]) => hasVal(v));
          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>{`EEG Report ${idx + 1}`}</Text>

              {sessionFields.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Session Information</Text>
                  {sessionFields.map(([key, val], i) => (
                    <View key={i} style={styles.fieldBox} wrap={false}>
                      <Text style={styles.fieldLabel}>{key === 'date' ? 'Date' : 'Neurologist'}</Text>
                      <Text style={styles.fieldValue}>1. {key === 'date' ? formatDate(val) : safeString(fmtVal(val))}</Text>
                    </View>
                  ))}
                </View>
              )}

              {renderSentenceSection('Indication', record.indication)}
              {renderSentenceSection('Technique', record.technique)}
              {renderSentenceSection('Background Activity', record.background)}
              {renderArraySection('Abnormalities', record.abnormalities)}
              {renderSentenceSection('Epileptiform Activity', record.epileptiformActivity)}
              {renderArraySection('Seizures', record.seizures)}
              {renderSentenceSection('Interpretation', record.interpretation)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default EegReportsDocumentPDFTemplate;
