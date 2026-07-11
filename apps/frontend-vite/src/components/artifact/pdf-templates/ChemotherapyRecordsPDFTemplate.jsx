/**
 * ChemotherapyRecordsPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom shoves the whole record → empty page 1);
 * per-FIELD gates with the section title inside the first field's unit + leaf glue (anti-orphan, 6a2d6af6).
 * Collection: chemotherapy_records
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#333333' },
});

/* ═══════ UTILS ═══════ */
const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(it => hasVal(it)) : [];
const hasNumber = (v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); return Number.isFinite(n) && n !== 0; };

const KEY_OVERRIDES = {
  wbc: 'WBC', rbc: 'RBC', hgb: 'Hgb', hct: 'Hct', plt: 'Platelets', anc: 'ANC',
  bp: 'BP', hr: 'HR', rr: 'RR', spo2: 'SpO2', temp: 'Temp', bsa: 'BSA',
  alt: 'ALT', ast: 'AST', bun: 'BUN', creatinine: 'Creatinine', egfr: 'eGFR',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const lk = String(key).toLowerCase();
  if (KEY_OVERRIDES[lk]) return KEY_OVERRIDES[lk];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/)
    .map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const FL = { regimen: 'Regimen', cycle: 'Cycle', day: 'Day', bsa: 'BSA (m²)', response: 'Response Assessment' };

/* recursive object → flat list of {indent, text, bold, numbered} — leaves get "1." numbering */
const objectLines = (label, value, indent, out) => {
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push({ indent, label, text: fmtScalar(value) }); return out; }
  if (label) out.push({ indent, heading: label });
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectLines(humanizeKey(k), v, indent + (label ? 1 : 0), out));
  return out;
};

/* ═══════ RENDER ═══════ */
/* Treatment: per-FIELD gate, section title rides inside the FIRST field's View (anti-orphan) */
const renderTreatmentSection = (record) => {
  const fields = ['regimen', 'cycle', 'day', 'bsa'];
  const present = fields.filter(f => f === 'regimen' ? hasVal(record[f]) : hasNumber(record[f]));
  if (present.length === 0) return null;
  return (
    <View style={styles.section}>
      {present.map((f, i) => (
        <View key={f} wrap={false}>
          {i === 0 && <Text style={styles.sectionTitle}>Treatment Information</Text>}
          <View style={{ marginBottom: 6 }}>
            <Text style={styles.fieldLabel}>{FL[f] || f}</Text>
            <Text style={styles.listItem}>1. {fmtVal(record[f])}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  return (
    <View style={styles.section} wrap={arr.length + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {arr.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(it)}</Text>)}
    </View>
  );
};

/* Object section: each scalar leaf = its own wrap={false} glue unit (label + "1. value"); headings glue with what follows */
const renderObjectSection = (sTitle, obj) => {
  if (!hasVal(obj) || isScalar(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  const lines = [];
  entries.forEach(([k, v]) => objectLines(humanizeKey(k), v, 0, lines));
  if (lines.length === 0) return null;
  return (
    <View style={styles.section}>
      {lines.map((ln, i) => (
        <View key={i} wrap={false}>
          {i === 0 && <Text style={styles.sectionTitle}>{sTitle}</Text>}
          {ln.heading != null
            ? <Text style={[styles.subLabel, { paddingLeft: 8 * ln.indent }]}>{ln.heading}</Text>
            : (
              <View style={{ marginBottom: 6, paddingLeft: 8 * ln.indent }}>
                {ln.label ? <Text style={styles.fieldLabel}>{ln.label}</Text> : null}
                <Text style={styles.listItem}>1. {ln.text}</Text>
              </View>
            )}
        </View>
      ))}
    </View>
  );
};

const renderResponseSection = (record) => {
  if (!hasVal(record.response)) return null;
  const strVal = fmtVal(record.response);
  const sentences = splitBySentence(strVal);
  const rows = sentences.length > 1 ? sentences.map(s => s.replace(/[;.]+$/, '').trim()) : [strVal];
  return (
    <View style={styles.section} wrap={rows.length + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>Response Assessment</Text>
      {rows.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}
    </View>
  );
};

const ChemotherapyRecordsPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.chemotherapy_records) return Array.isArray(r.chemotherapy_records) ? r.chemotherapy_records : [r.chemotherapy_records];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chemotherapy_records) return Array.isArray(dd.chemotherapy_records) ? dd.chemotherapy_records : [dd.chemotherapy_records]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Chemotherapy Records</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Chemotherapy Records</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Chemotherapy Record ${idx + 1}`}</Text>
              {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>
            {renderTreatmentSection(record)}
            {renderArraySection('Medications', record.medications)}
            {renderArraySection('Premedications', record.premedications)}
            {renderArraySection('Dosing', record.dosing)}
            {renderArraySection('Toxicities', record.toxicities)}
            {renderObjectSection('Lab Values', record.labValues)}
            {renderObjectSection('Vitals', record.vitals)}
            {renderResponseSection(record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ChemotherapyRecordsPDFTemplate;
