/**
 * AutopsyReportsPDFTemplate.jsx
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
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  separator: { fontSize: 10, color: '#999999', marginBottom: 8, textAlign: 'center' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (t) => {
  if (!t || typeof t !== 'string') return [];
  let prepared = t
    .replace(/\bDr\.\s/g, 'Dr_DOT_ ').replace(/\bMr\.\s/g, 'Mr_DOT_ ').replace(/\bMrs\.\s/g, 'Mrs_DOT_ ').replace(/\bMs\.\s/g, 'Ms_DOT_ ')
    .replace(/\bProf\.\s/g, 'Prof_DOT_ ').replace(/\bJr\.\s/g, 'Jr_DOT_ ').replace(/\bSr\.\s/g, 'Sr_DOT_ ').replace(/\bvs\.\s/g, 'vs_DOT_ ')
    .replace(/\betc\.\s/g, 'etc_DOT_ ').replace(/\bSt\.\s/g, 'St_DOT_ ').replace(/(^|[\s(])([A-Z])\.\s/g, '$1$2_DOT_ ');
  const restore = (s) => s
    .replace(/Dr_DOT_/g, 'Dr.').replace(/Mr_DOT_/g, 'Mr.').replace(/Mrs_DOT_/g, 'Mrs.').replace(/Ms_DOT_/g, 'Ms.')
    .replace(/Prof_DOT_/g, 'Prof.').replace(/Jr_DOT_/g, 'Jr.').replace(/Sr_DOT_/g, 'Sr.').replace(/vs_DOT_/g, 'vs.')
    .replace(/etc_DOT_/g, 'etc.').replace(/St_DOT_/g, 'St.').replace(/([A-Z])_DOT_/g, '$1.');
  return prepared.split(/(?<=[.!?])\s+/).map(s => restore(s.trim())).filter(s => { const tr = s.trim(); return tr.length > 0 && tr.replace(/[.!?;,]+/g, '').trim().length > 0; });
};
const stripTime = (val) => { if (!val) return ''; const s = String(val.$date || val); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/); if (m) { try { return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return s; } } return s; };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
// Split a value into rows ONLY on depth-0 ';' (paren-aware, parity with JSX); commas stay intact
// ("1,820 g, chronic passive congestion" stays one row). Used for labeled values + unlabeled prose.
const splitSemicolons = (text) => {
  if (!text || typeof text !== 'string') return [];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (depth === 0 && ch === ';') { const t = cur.trim().replace(/[.;,]+$/, ''); if (t) out.push(t); cur = ''; continue; }
    cur += ch;
  }
  const t = cur.trim().replace(/[.;,]+$/, ''); if (t) out.push(t);
  return out;
};
const VALUE_CRED = /^(?:MD|DO|PhD|PharmD|PA|JD|RN|NP|DDS|DMD|DVM|Esq|FACP|FCAP|FACS|MPH|MBA|MSN|BSN|CSFA|CRNA|II|III|IV|Jr|Sr)\b/;
const VALUE_MEASURE = /^[\d][\d.,]*\s*[A-Za-z/%µ]+\.?$/;
// LABELED value → rows (parity with JSX): ';' always splits; a depth-0 ',' splits UNLESS inside parens,
// between digits, before a year/and/or/credential, OR when the clause before the comma is a bare
// measurement ("180 g, unremarkable" stays one row); comma lists ("Na 148, K 9.2, …") split normally.
const splitClauseValue = (text) => {
  if (!text || typeof text !== 'string') return [];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (depth === 0 && (ch === ';' || ch === ',')) {
      if (ch === ',') { const prev = text[i - 1] || '', nx = text[i + 1] || ''; const rest = text.slice(i + 1).trimStart(); if ((/\d/.test(prev) && /\d/.test(nx)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest) || VALUE_CRED.test(rest) || VALUE_MEASURE.test(cur.trim())) { cur += ch; continue; } }
      const t = cur.trim().replace(/[.;,]+$/, ''); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim().replace(/[.;,]+$/, ''); if (t) out.push(t);
  return out;
};

const AutopsyReportsPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.autopsy_reports) return Array.isArray(r.autopsy_reports) ? r.autopsy_reports : [r.autopsy_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.autopsy_reports) return Array.isArray(dd.autopsy_reports) ? dd.autopsy_reports : [dd.autopsy_reports]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  const renderField = (label, value) => { if (!value || String(value).trim() === '') return null; return <View style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>; };
  // Anti-orphan (memories 6a3cda8c + 6a4136d3): the section title lives INSIDE the block, never a wrapping
  // sibling. <=8 rows → atomic wrap={false} (the whole title+rows block moves to the next page together).
  // >8 rows → wrap={true} with the title + FIRST block GLUED in a wrap={false} sub-View and the remaining
  // blocks flowing as siblings, so the title can never strand. BOOLEAN wrap (wrap={undefined}===false on v4).
  const renderTitledBlocks = (label, blocks, rowCount) => {
    if (!blocks || blocks.length === 0) return null;
    if (rowCount <= 8) return <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{label}</Text>{blocks}</View>;
    return <View style={styles.fieldContainer} wrap={true}><View key="glue" wrap={false}><Text style={styles.sectionTitle}>{label}</Text>{blocks[0]}</View>{blocks.slice(1)}</View>;
  };
  // Clinical narrative: a labeled "Label: value" sentence → bold sub-label + numbered paren-aware clauses;
  // an unlabeled sentence → a plain line. Never side-by-side "Label: value".
  const renderClinicalSection = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length === 0) return null;
    if (sentences.length === 1 && !parseLabel(sentences[0]).isLabeled && splitSemicolons(sentences[0]).length <= 1) return renderField(label, value);
    let rowCount = 0;
    const blocks = sentences.map((s, i) => {
      const p = parseLabel(s);
      if (p.isLabeled) { const clauses = splitClauseValue(p.value); const cs = clauses.length ? clauses : [p.value.replace(/[.;,]+$/, '')]; rowCount += cs.length + 1; return <View key={i} wrap={false}><Text style={styles.subLabel}>{p.label}</Text>{cs.map((c, ci) => <Text key={ci} style={styles.listItem}>{ci + 1}. {c}</Text>)}</View>; }
      const semis = splitSemicolons(s);
      if (semis.length > 1) { rowCount += semis.length; return <View key={i} wrap={false}>{semis.map((c, ci) => <Text key={ci} style={styles.listItem}>{ci + 1}. {c}</Text>)}</View>; }
      rowCount += 1;
      return <Text key={i} style={styles.listItem}>{s}</Text>;
    });
    return renderTitledBlocks(label, blocks, rowCount);
  };
  const renderArrayField = (label, items) => { if (!items || !Array.isArray(items) || items.length === 0) return null; const blocks = items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(it)}</Text>); return renderTitledBlocks(label, blocks, items.length); };

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Autopsy Reports</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Autopsy Reports</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Autopsy Report ${idx + 1}`}</Text>{record.autopsyDate && <Text style={styles.recordMeta}>{stripTime(record.autopsyDate)}</Text>}</View>
            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}
            {(record.pathologist || record.facility || record.decedentName || record.autopsyType || record.mannerOfDeath || record.dateOfDeath || record.autopsyDate) && <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Record Information</Text>{renderField('Pathologist', record.pathologist)}{renderField('Facility', record.facility)}{renderField('Decedent Name', record.decedentName)}{renderField('Autopsy Type', record.autopsyType)}{renderField('Manner of Death', record.mannerOfDeath)}{renderField('Date of Death', stripTime(record.dateOfDeath))}{renderField('Autopsy Date', stripTime(record.autopsyDate))}</View>}
            {renderClinicalSection('Indication', record.indication)}
            {renderClinicalSection('External Examination', record.externalExamination)}
            {renderClinicalSection('Internal Examination', record.internalExamination)}
            {renderClinicalSection('Cardiovascular', record.cardiovascular)}
            {renderClinicalSection('Respiratory', record.respiratory)}
            {renderClinicalSection('Gastrointestinal', record.gastrointestinal)}
            {renderClinicalSection('Neurological/Brain', record.neurologicalBrain)}
            {renderClinicalSection('Toxicology', record.toxicology)}
            {renderClinicalSection('Microscopic', record.microscopic)}
            {renderClinicalSection('Cause of Death', record.causeOfDeath)}
            {renderArrayField('Contributing Factors', record.contributingFactors)}
            {renderClinicalSection('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AutopsyReportsPDFTemplate;
