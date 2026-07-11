/**
 * BiopsyReportsDocumentPDFTemplate.jsx
 * Helvetica font, 20/14/12pt hierarchy, numbered items, no label:value
 * Conditional wrap pattern, no page footers
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 24, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8, backgroundColor: '#f0f0f0', padding: 8, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 4, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 20, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 6 },
  listItem: { fontSize: 12, lineHeight: 1.6, paddingLeft: 12, marginBottom: 5 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };

// Built-in Helvetica lacks → ≥ ≤ µ × etc.; a missing glyph renders as garbage AND eats the next space — ASCII-map.
const pdfSafe = (s) => String(s == null ? '' : s).replace(/→/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/µ/g, 'u').replace(/μ/g, 'u').replace(/±/g, '+/-').replace(/×/g, 'x').replace(/÷/g, '/').replace(/°/g, ' deg').replace(/—/g, '-').replace(/–/g, '-');

// Abbreviations whose trailing period must NOT end a clause (mirror of the JSX splitter).
const ABBR_SET = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'rev', 'sr', 'jr', 'st', 'gen', 'col', 'sgt', 'lt', 'capt', 'vs', 'etc', 'no', 'approx', 'fig', 'dx', 'hx']);
const endsWithAbbrev = (buf) => { const m = String(buf).trim().match(/(\w+)$/); return m ? ABBR_SET.has(m[1].toLowerCase()) : false; };

// IDENTICAL to BiopsyReportsDocument.jsx splitClauses — split on BOTH commas AND sentence terminators
// (. ! ? ;), paren-aware, decimal-safe (3.5), thousands-safe (1,500), abbreviation-safe (Dr.).
const splitClauses = (text) => {
  if (!text || typeof text !== 'string') return [];
  const s = text.trim();
  const out = [];
  let buf = '', depth = 0;
  const flush = () => { const t = buf.replace(/^[\s.;,!?]+/, '').replace(/[\s.;,!?]+$/, '').trim(); if (t) out.push(t); buf = ''; };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') { depth++; buf += ch; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { if (depth > 0) depth--; buf += ch; continue; }
    const prev = s[i - 1] || '', next = s[i + 1] || '';
    let boundary = false;
    if (depth === 0) {
      if (ch === ',') boundary = !(/\d/.test(prev) && /\d/.test(next));
      else if (ch === '.' || ch === '!' || ch === '?' || ch === ';') boundary = (next === '' || /\s/.test(next)) && !(ch === '.' && /\d/.test(prev) && /\d/.test(next)) && !(ch === '.' && endsWithAbbrev(buf));
    }
    if (boundary) { flush(); while (i + 1 < s.length && /\s/.test(s[i + 1])) i++; continue; }
    buf += ch;
  }
  flush();
  return out;
};

// One narrative section = ONE View. <=8 rows → atomic wrap={false} (moves whole → no orphan, no
// overprint). >8 rows → boolean wrap={true} with the title GLUED to the first row in a wrap={false}
// sub-View (orphan-proof). @react-pdf 4.3.2: wrap MUST be boolean — wrap={undefined} === wrap={false}.
const renderNarrativeSection = (title, items) => {
  if (!items || items.length === 0) return null;
  if (items.length <= 8) return (
    <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>
      {items.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(s)}</Text>)}
    </View>
  );
  return (
    <View style={styles.fieldContainer} wrap={true}>
      <View wrap={false}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.listItem}>1. {pdfSafe(items[0])}</Text></View>
      {items.slice(1).map((s, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {pdfSafe(s)}</Text>)}
    </View>
  );
};

const BiopsyReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.biopsy_reports) return Array.isArray(r.biopsy_reports) ? r.biopsy_reports : [r.biopsy_reports]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.biopsy_reports) return Array.isArray(dd.biopsy_reports) ? dd.biopsy_reports : [dd.biopsy_reports]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Biopsy Reports</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Biopsy Reports</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Biopsy Report ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}{record.pathologist && <Text style={styles.recordMeta}>{pdfSafe(record.pathologist)}</Text>}</View>

            {/* Diagnosis */}
            {record.diagnosis && (
              <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Diagnosis</Text>
                <Text style={styles.listItem}>{pdfSafe(record.diagnosis)}</Text>
              </View>
            )}

            {/* Specimen Information */}
            {(record.biopsySite || record.biopsyMethod) && (
              <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Specimen Information</Text>
                {record.biopsySite && <Text style={styles.listItem}>1. {pdfSafe(record.biopsySite)}</Text>}
                {record.biopsyMethod && <Text style={styles.listItem}>{record.biopsySite ? '2' : '1'}. {pdfSafe(record.biopsyMethod)}</Text>}
              </View>
            )}

            {/* Clinical History — split on commas + sentence terminators (mirrors JSX splitClauses) */}
            {record.clinicalHistory && renderNarrativeSection('Clinical History', splitClauses(String(record.clinicalHistory)))}

            {/* Gross Description — split on commas + sentence terminators */}
            {record.grossDescription && renderNarrativeSection('Gross Description', splitClauses(String(record.grossDescription)))}

            {/* Microscopic Description — split on commas + sentence terminators */}
            {record.microscopicDescription && renderNarrativeSection('Microscopic Description', splitClauses(String(record.microscopicDescription)))}

            {/* Specimen Adequacy */}
            {record.adequacy && (
              <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Specimen Adequacy</Text>
                <Text style={styles.listItem}>{pdfSafe(record.adequacy)}</Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BiopsyReportsDocumentPDFTemplate;
