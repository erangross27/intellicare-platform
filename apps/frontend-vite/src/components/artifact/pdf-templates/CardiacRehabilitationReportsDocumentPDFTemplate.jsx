/**
 * CardiacRehabilitationReportsDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: cardiac_rehabilitation_reports
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
  subLabelLine: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 8, marginBottom: 4, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; return true; };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
// Split a list on ", " only — parenthesis-aware, so "1,500" (no space) and "(a, b)" stay intact.
const splitByComma = (text) => { const s = String(text || ''); const out = []; let cur = '', depth = 0; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); if (ch === ',' && depth === 0 && /\s/.test(s[i + 1] || '')) { const t = cur.trim(); if (t) out.push(t); cur = ''; } else cur += ch; } const t = cur.trim(); if (t) out.push(t); return out; };
// Narrative field → continuous items: each sentence, comma-split (>=2 items) into separate rows.
const fieldItems = (text) => { const out = []; splitBySentence(text).forEach(sent => { const parts = splitByComma(sent); if (parts.length >= 2) parts.forEach(p => out.push(p)); else out.push(sent); }); return out; };
// "Label: value" (short label + colon+space) → {label, content}; else null. Lowercase-start allowed (e.g. "target heart rate:").
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&()%,-]{0,49}?):\s*(.+)$/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
// Render narrative items: labeled part → underlined subtitle line + numbered value below; plain part → "N. value".
// The number lives on the CONTENT (not the subtitle) so each content line references its subtitle. Continuous count.
const renderItems = (text) => { let n = 0; return fieldItems(text).map((s, i) => { const pp = parseLabel(s); n += 1; return pp ? (<View key={i} wrap={false}><Text style={styles.subLabelLine}>{pp.label}</Text><Text style={styles.listItem}>{n}. {pp.content}</Text></View>) : (<Text key={i} style={styles.listItem}>{n}. {s}</Text>); }); };

const CardiacRehabilitationReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cardiac_rehabilitation_reports) return Array.isArray(r.cardiac_rehabilitation_reports) ? r.cardiac_rehabilitation_reports : [r.cardiac_rehabilitation_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiac_rehabilitation_reports) return Array.isArray(dd.cardiac_rehabilitation_reports) ? dd.cardiac_rehabilitation_reports : [dd.cardiac_rehabilitation_reports]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Cardiac Rehabilitation Reports</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cardiac Rehabilitation Reports</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Cardiac Rehabilitation Report ${idx + 1}`}</Text>
              {record.assessmentDate && <Text style={styles.recordMeta}>{formatDate(record.assessmentDate)}</Text>}
              {record.programType && <Text style={styles.recordMeta}>{record.programType}</Text>}
            </View>
            {hasVal(record.programType) && (<View style={styles.fieldContainer}><Text style={styles.subSectionTitle}>Program Type</Text><Text style={styles.listItem}>{record.programType}</Text></View>)}
            {hasVal(record.findings) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Findings</Text>{renderItems(record.findings)}</View>)}
            {hasVal(record.goals) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Goals</Text>{renderItems(record.goals)}</View>)}
            {hasVal(record.recommendations) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Recommendations</Text>{renderItems(record.recommendations)}</View>)}
            {hasVal(record.progress) && (<View style={styles.fieldContainer}><Text style={styles.subSectionTitle}>Progress</Text><Text style={styles.listItem}>{record.progress}</Text></View>)}
            {hasVal(record.followUp) && (<View style={styles.fieldContainer}><Text style={styles.subSectionTitle}>Follow-Up</Text><Text style={styles.listItem}>{record.followUp}</Text></View>)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CardiacRehabilitationReportsDocumentPDFTemplate;
