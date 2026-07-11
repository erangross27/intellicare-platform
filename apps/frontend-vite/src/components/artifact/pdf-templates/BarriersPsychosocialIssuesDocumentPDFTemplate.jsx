/**
 * BarriersPsychosocialIssuesDocumentPDFTemplate.jsx
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
  fieldValue: { fontSize: 12, color: '#404040', paddingLeft: 12, lineHeight: 1.4 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  separator: { fontSize: 10, color: '#999999', marginBottom: 8, textAlign: 'center' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (t) => { if (!t || typeof t !== 'string') return []; return t.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)\.)(?<=[.!?])\s+/).filter(s => { const tr = s.trim(); return tr.length > 0 && tr.replace(/[.!?;,]+/g, '').trim().length > 0; }); };
// Paren-aware comma splitter (parity with the JSX): depth-0 ',' splits UNLESS inside parens, between two
// digits, before a 4-digit year, or before whole-word "and"/"or".
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const prev = text[i - 1] || '', nx = text[i + 1] || ''; const rest = text.slice(i + 1).trimStart();
      if ((/\d/.test(prev) && /\d/.test(nx)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out;
};
const parseLabel = (s) => { if (!s || typeof s !== 'string') return { isLabeled: false, label: '', value: s || '' }; const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: s }; };

const BarriersPsychosocialIssuesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.barriers_psychosocial_issues) return Array.isArray(r.barriers_psychosocial_issues) ? r.barriers_psychosocial_issues : [r.barriers_psychosocial_issues];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.barriers_psychosocial_issues) return Array.isArray(dd.barriers_psychosocial_issues) ? dd.barriers_psychosocial_issues : [dd.barriers_psychosocial_issues]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // Stacked (bold label ABOVE value, NO colon) — never side-by-side "Label: value".
  const renderField = (label, value) => { if (!value || String(value).trim() === '') return null; return <View style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>; };
  // Notes-style field: each sentence "Label: value" → bold sub-label + value (nested, no side-by-side);
  // an unlabeled sentence → a plain line. Mirrors the JSX nested-subtitle.
  const renderSentenceField = (label, value) => { if (!value || String(value).trim() === '') return null; const ss = splitBySentence(String(value)); if (ss.length === 0) return null; if (ss.length === 1 && !parseLabel(ss[0]).isLabeled) return renderField(label, value); return <View style={styles.fieldContainer} wrap={ss.length > 8}><Text style={styles.sectionTitle}>{label}</Text>{ss.map((s, i) => { const p = parseLabel(s); if (p.isLabeled) return <View key={i} wrap={false}><Text style={styles.subLabel}>{p.label}</Text><Text style={styles.listItem}>{p.value}</Text></View>; return <Text key={i} style={styles.listItem}>{s}</Text>; })}</View>; };
  const renderArrayField = (label, items) => { if (!items || !Array.isArray(items) || items.length === 0) return null; return <View style={styles.fieldContainer} wrap={items.length > 8 ? undefined : false}><Text style={styles.sectionTitle}>{label}</Text>{items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(it)}</Text>)}</View>; };
  // Comma-split list field → numbered rows (one item, no comma → unchanged side-by-side renderField).
  const renderCommaField = (label, value) => { if (!value || String(value).trim() === '') return null; const items = splitByComma(String(value)); if (items.length <= 1) return renderField(label, value); return <View style={styles.fieldContainer} wrap={items.length > 8}><Text style={styles.sectionTitle}>{label}</Text>{items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}</View>; };

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Barriers and Psychosocial Issues</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Barriers and Psychosocial Issues</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Barriers & Psychosocial Issues ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>}</View>
            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}
            {(record.provider || record.facility) && <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Record Information</Text>{renderField('Provider', record.provider)}{renderField('Facility', record.facility)}</View>}
            {(record.barrierType || record.description) && <View style={styles.fieldContainer} wrap={splitByComma(String(record.description || '')).length > 8}><Text style={styles.sectionTitle}>Barrier Information</Text>{renderField('Barrier Type', record.barrierType)}{renderCommaField('Description', record.description)}</View>}
            {(record.impactOnCare || record.financialConcerns || record.transportationIssues || record.housingStability || record.foodInsecurity) && <View style={styles.fieldContainer} wrap={(splitByComma(String(record.impactOnCare || '')).length + splitByComma(String(record.financialConcerns || '')).length) > 8}><Text style={styles.sectionTitle}>Impact and Concerns</Text>{renderCommaField('Impact on Care', record.impactOnCare)}{renderCommaField('Financial Concerns', record.financialConcerns)}{renderField('Transportation Issues', record.transportationIssues)}{renderField('Housing Stability', record.housingStability)}{renderField('Food Insecurity', record.foodInsecurity)}</View>}
            {(record.socialSupport || record.mentalHealth || record.substanceUse || record.literacyLanguage) && <View style={styles.fieldContainer} wrap={(splitByComma(String(record.socialSupport || '')).length + splitByComma(String(record.mentalHealth || '')).length) > 8}><Text style={styles.sectionTitle}>Social and Mental Health</Text>{renderCommaField('Social Support', record.socialSupport)}{renderCommaField('Mental Health', record.mentalHealth)}{renderField('Substance Use', record.substanceUse)}{renderField('Literacy/Language', record.literacyLanguage)}</View>}
            {renderArrayField('Interventions', record.interventions)}
            {renderArrayField('Resources Provided', record.resourcesProvided)}
            {renderField('Social Worker', record.socialWorker)}
            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BarriersPsychosocialIssuesDocumentPDFTemplate;
