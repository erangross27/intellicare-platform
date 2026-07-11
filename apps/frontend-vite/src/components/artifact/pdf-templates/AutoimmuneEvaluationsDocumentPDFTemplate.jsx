/**
 * AutoimmuneEvaluationsDocumentPDFTemplate.jsx
 * PDFDownloadLink + pdfData memo pattern, ASCII separators, Helvetica
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 24, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8, backgroundColor: '#f0f0f0', padding: 8, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 4, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  fieldBlock: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#404040', marginBottom: 1 },
  fieldValue: { fontSize: 12, color: '#404040', lineHeight: 1.4, paddingLeft: 12 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  separator: { fontSize: 10, color: '#999999', marginBottom: 8, textAlign: 'center' },
});

const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (t) => { if (!t || typeof t !== 'string') return []; return t.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\.)(?<=[.!?])\s+|(?<=;)\s+/).filter(s => { const tr = s.trim(); return tr.length > 0 && tr.replace(/[.!?;,]+/g, '').trim().length > 0; }); };
// paren-aware comma split (digit/year/and-or guarded) for COMMA_SPLIT fields like physicalExam.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const prev = text[i - 1] || '', next = text[i + 1] || '';
      const rest = text.slice(i + 1).trimStart();
      if ((/\d/.test(prev) && /\d/.test(next)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const AutoimmuneEvaluationsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.autoimmune_evaluations) return Array.isArray(r.autoimmune_evaluations) ? r.autoimmune_evaluations : [r.autoimmune_evaluations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.autoimmune_evaluations) return Array.isArray(dd.autoimmune_evaluations) ? dd.autoimmune_evaluations : [dd.autoimmune_evaluations]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // Stacked label-above-value (NEVER side-by-side "Label: value", no colon). Each field atomic.
  const renderField = (label, value) => { if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null; return <View style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>; };
  // Title + numbered list as ONE page-break unit (react-pdf v4 anti-orphan, memory 6a3cda8c).
  // <=8 rows: wrap={false} → the whole block (title + rows) moves to the next page intact → no orphan,
  // and it always fits one page so it never compresses → no overprint.
  // >8 rows: wrap → list flows across pages, with [title + first row] GLUED in a wrap={false} sub-View
  // so the title can never strand alone at a page bottom; the remaining rows flow as siblings.
  const renderTitledList = (title, items) => {
    if (!items || items.length === 0) return null;
    if (items.length <= 8) return <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{items.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(s)}</Text>)}</View>;
    return <View style={styles.fieldContainer} wrap><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.listItem}>1. {String(items[0])}</Text></View>{items.slice(1).map((s, i) => <Text key={i + 1} style={styles.listItem}>{i + 2}. {String(s)}</Text>)}</View>;
  };
  const renderSentenceField = (label, value) => { if (!value || String(value).trim() === '') return null; const ss = splitBySentence(String(value)); if (ss.length <= 1) return renderField(label, value); return renderTitledList(label, ss); };
  const renderArrayField = (label, items) => { if (!items || !Array.isArray(items) || items.length === 0) return null; return renderTitledList(label, items); };
  // COMMA_SPLIT field (physicalExam): split into a numbered list (never side-by-side "Label: value").
  const renderCommaField = (label, value) => { if (!value || String(value).trim() === '') return null; const items = splitByComma(String(value)); if (items.length <= 1) return renderField(label, value); return renderTitledList(label, items); };

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Autoimmune Evaluations</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Autoimmune Evaluations</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Autoimmune Evaluation ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}</View>
            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}
            {(record.rheumatologist || record.facility) && <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Record Information</Text>{renderField('Rheumatologist', record.rheumatologist)}{renderField('Facility', record.facility)}</View>}
            {(record.suspectedCondition || record.diagnosis || record.diseaseActivity) && <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Clinical Information</Text>{renderField('Suspected Condition', record.suspectedCondition)}{renderField('Diagnosis', record.diagnosis)}{renderField('Disease Activity', record.diseaseActivity)}</View>}
            {renderArrayField('Symptoms', record.symptoms)}
            {renderCommaField('Physical Exam', record.physicalExam)}
            {record.serology && typeof record.serology === 'object' && (() => {
              const entries = Object.entries(record.serology).filter(([, v]) => { if (v === null || v === undefined) return false; if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0; return String(v).trim() !== ''; });
              if (entries.length === 0) return null;
              const rowCount = entries.reduce((n, [, v]) => n + (Array.isArray(v) ? v.length : 1), 0);
              const renderEntry = ([k, v]) => Array.isArray(v)
                ? <View key={k} wrap={false}><Text style={{ ...styles.fieldLabel, marginTop: 4 }}>{humanizeKey(k)}</Text>{v.map((t, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(t)}</Text>)}</View>
                : <View key={k} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{humanizeKey(k)}</Text><Text style={styles.fieldValue}>{String(v)}</Text></View>;
              // <=8 rows: atomic block (no orphan). >8: flow, with [Serology title + first entry] glued so the title never strands.
              if (rowCount <= 8) return <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Serology</Text>{entries.map(renderEntry)}</View>;
              return <View style={styles.fieldContainer} wrap><View wrap={false}><Text style={styles.sectionTitle}>Serology</Text>{renderEntry(entries[0])}</View>{entries.slice(1).map(renderEntry)}</View>;
            })()}
            {renderField('Inflammatory Markers', record.inflammatoryMarkers)}
            {renderArrayField('Organ Involvement', record.organInvolvement)}
            {renderSentenceField('Imaging', record.imaging)}
            {renderSentenceField('Biopsy', record.biopsy)}
            {renderArrayField('Treatment', record.treatment)}
            {renderSentenceField('Monitoring', record.monitoring)}
            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AutoimmuneEvaluationsDocumentPDFTemplate;
