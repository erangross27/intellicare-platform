/**
 * BiologicTherapyDocumentPDFTemplate.jsx
 * Flat biologic_therapy collection. Box-free B&W, Helvetica, stacked colon-free fields
 * (bold label ABOVE value, never side-by-side "Label: value"). Rule #74 page breaks with
 * orphan-proof glue (title + first row) for sections > 8 rows. Boolean wrap (never undefined).
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
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  subLabel2: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#404040', marginTop: 2, marginBottom: 1, paddingLeft: 12 },
  listItem: { fontSize: 12, color: '#404040', paddingLeft: 12, lineHeight: 1.4, marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const SECTION_FIELDS = {
  recordInfo: ['provider', 'facility'],
  medication: ['medicationName', 'indication', 'dose', 'route', 'frequency', 'startDate'],
  clinical: ['response', 'priorAuthorization'],
  monitoring: ['monitoringLabs', 'baselineAssessment'],
  safety: ['sideEffects', 'infusionReactions'],
  plan: ['continuationPlan'],
  notes: ['notes'],
};
const SECTION_TITLES = {
  recordInfo: 'Record Information', medication: 'Medication', clinical: 'Clinical Response',
  monitoring: 'Monitoring', safety: 'Side Effects & Reactions', plan: 'Continuation Plan', notes: 'Notes',
};
const FIELD_LABELS = {
  provider: 'Provider', facility: 'Facility',
  medicationName: 'Medication Name', indication: 'Indication', dose: 'Dose', route: 'Route', frequency: 'Frequency', startDate: 'Start Date',
  response: 'Response', priorAuthorization: 'Prior Authorization',
  monitoringLabs: 'Monitoring Labs', baselineAssessment: 'Baseline Assessment',
  sideEffects: 'Side Effects', infusionReactions: 'Infusion Reactions',
  continuationPlan: 'Continuation Plan', notes: 'Notes',
};
const DATE_FIELDS = ['startDate'];
const ARRAY_FIELDS = ['monitoringLabs'];
const SENTENCE_FIELDS = ['priorAuthorization', 'baselineAssessment', 'sideEffects', 'infusionReactions', 'continuationPlan', 'notes'];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (t) => { if (!t || typeof t !== 'string') return []; return t.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)\.)(?<=[.!?])\s+/).filter(s => { const tr = s.trim(); return tr.length > 0 && tr.replace(/[.!?;,]+/g, '').trim().length > 0; }); };
const parseLabel = (s) => { if (!s || typeof s !== 'string') return { isLabeled: false, label: '', value: s || '' }; const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: s }; };
// Built-in Helvetica lacks → ≥ ≤ µ etc.; a missing glyph renders as garbage AND eats the next space — ASCII-map.
const pdfSafe = (s) => String(s == null ? '' : s).replace(/→/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/µ/g, 'u').replace(/±/g, '+/-').replace(/×/g, 'x').replace(/÷/g, '/').replace(/°/g, ' deg').replace(/—/g, '-').replace(/–/g, '-');

const BiologicTherapyDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.biologic_therapy) return Array.isArray(r.biologic_therapy) ? r.biologic_therapy : [r.biologic_therapy]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.biologic_therapy) return Array.isArray(dd.biologic_therapy) ? dd.biologic_therapy : [dd.biologic_therapy]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // All renderable rows for one field, beginning with its bold label (stacked colon-free).
  const fieldRows = (fn, value) => {
    const label = FIELD_LABELS[fn] || fn;
    if (DATE_FIELDS.includes(fn)) { const dv = formatDate(value); if (!dv) return []; return [<Text key={`${fn}-l`} style={styles.subLabel}>{label}</Text>, <Text key={`${fn}-v`} style={styles.listItem}>{pdfSafe(dv)}</Text>]; }
    if (ARRAY_FIELDS.includes(fn)) { const items = (Array.isArray(value) ? value : []).filter(x => x !== null && x !== undefined && String(x).trim() !== ''); if (items.length === 0) return []; return [<Text key={`${fn}-l`} style={styles.subLabel}>{label}</Text>, ...items.map((it, i) => <Text key={`${fn}-${i}`} style={styles.listItem}>{i + 1}. {pdfSafe(it)}</Text>)]; }
    if (value === null || value === undefined || String(value).trim() === '') return [];
    // Only narrative fields are sentence-split; simple fields (e.g. provider "Dr. A. Lee, MD") stay one value.
    const ss = SENTENCE_FIELDS.includes(fn) ? splitBySentence(String(value)) : [String(value).trim()];
    if (ss.length <= 1) {
      const p = parseLabel(String(value));
      if (p.isLabeled) return [<Text key={`${fn}-l`} style={styles.subLabel}>{label}</Text>, <Text key={`${fn}-sl`} style={styles.subLabel2}>{pdfSafe(p.label)}</Text>, <Text key={`${fn}-v`} style={styles.listItem}>{pdfSafe(p.value)}</Text>];
      return [<Text key={`${fn}-l`} style={styles.subLabel}>{label}</Text>, <Text key={`${fn}-v`} style={styles.listItem}>{pdfSafe(String(value))}</Text>];
    }
    const hasLabels = ss.some(s => parseLabel(s).isLabeled);
    const rows = [<Text key={`${fn}-l`} style={styles.subLabel}>{label}</Text>];
    ss.forEach((s, i) => { const p = parseLabel(s); if (p.isLabeled) { rows.push(<Text key={`${fn}-${i}-l`} style={styles.subLabel2}>{pdfSafe(p.label)}</Text>); rows.push(<Text key={`${fn}-${i}-v`} style={styles.listItem}>{pdfSafe(p.value)}</Text>); } else { rows.push(<Text key={`${fn}-${i}`} style={styles.listItem}>{hasLabels ? '' : `${i + 1}. `}{pdfSafe(s)}</Text>); } });
    return rows;
  };

  // One section = ONE View, sectionTitle inside (Rule #74). <=8 rows → atomic wrap={false};
  // >8 rows → wrap glue [title + first row] in a wrap={false} sub-View, rest flow (orphan-proof).
  const renderSectionPDF = (record, sid) => {
    const fs = SECTION_FIELDS[sid] || []; const title = SECTION_TITLES[sid] || sid;
    const single = fs.length === 1 && (FIELD_LABELS[fs[0]] || fs[0]) === title;
    let allRows = [];
    fs.forEach(fn => { const rows = fieldRows(fn, record[fn]); if (rows.length === 0) return; allRows = allRows.concat(single ? rows.slice(1) : rows); });
    if (allRows.length === 0) return null;
    if (allRows.length <= 8) return <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{allRows}</View>;
    return <View style={styles.fieldContainer} wrap={true}><View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{allRows[0]}</View>{allRows.slice(1)}</View>;
  };

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Biologic Therapy</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Biologic Therapy</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection} break={idx > 0}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Biologic Therapy ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}</View>
            {Object.keys(SECTION_FIELDS).map(sid => <React.Fragment key={sid}>{renderSectionPDF(record, sid)}</React.Fragment>)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default BiologicTherapyDocumentPDFTemplate;
