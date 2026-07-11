/**
 * EggRetrievalProcedureDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: hide-zero sentinel numerics,
 * enum canonical, sentence parseLabel, number+unit labels. Collection: egg_retrieval_procedure
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

const FIELD_LABELS = {
  procedureDate: 'Procedure Date', retrievalPhysician: 'Retrieval Physician', anesthesiaType: 'Anesthesia Type',
  procedureDuration: 'Procedure Duration (min)', needleGauge: 'Needle Gauge', aspirationPressure: 'Aspiration Pressure (mmHg)',
  totalOocytesRetrieved: 'Total Oocytes Retrieved', matureOocytesMII: 'Mature Oocytes (MII)', immatureOocytesMI: 'Immature Oocytes (MI)',
  germinaalVesicleOocytes: 'Germinal Vesicle Oocytes', degeneratedOocytes: 'Degenerated Oocytes',
  leftOvaryFolliclesAspirated: 'Left Ovary Follicles Aspirated', rightOvaryFolliclesAspirated: 'Right Ovary Follicles Aspirated',
  antralFollicleCount: 'Antral Follicle Count', antiMullerianHormoneLevel: 'Anti-Mullerian Hormone Level (ng/mL)',
  preRetrievalEstradiolLevel: 'Pre-Retrieval Estradiol Level (pg/mL)', preRetrievalProgesteroneLevel: 'Pre-Retrieval Progesterone Level (ng/mL)',
  endometrialThickness: 'Endometrial Thickness (mm)', triggerMedicationType: 'Trigger Medication Type',
  triggerToRetrievalInterval: 'Trigger to Retrieval Interval (hrs)', flushingMediaUsed: 'Flushing Media Used',
  ovarianHyperstimulationRisk: 'Ovarian Hyperstimulation Risk', proceduralComplications: 'Procedural Complications',
  estimatedBloodLoss: 'Estimated Blood Loss (mL)', postProcedurePainScore: 'Post-Procedure Pain Score',
};

const SECTION_CONFIG = [
  { title: 'Procedure Information', fields: ['procedureDate', 'retrievalPhysician', 'anesthesiaType', 'procedureDuration', 'needleGauge', 'aspirationPressure'] },
  { title: 'Oocyte Results', fields: ['totalOocytesRetrieved', 'matureOocytesMII', 'immatureOocytesMI', 'germinaalVesicleOocytes', 'degeneratedOocytes'] },
  { title: 'Ovarian Details', fields: ['leftOvaryFolliclesAspirated', 'rightOvaryFolliclesAspirated', 'antralFollicleCount', 'antiMullerianHormoneLevel'] },
  { title: 'Hormonal Levels', fields: ['preRetrievalEstradiolLevel', 'preRetrievalProgesteroneLevel', 'endometrialThickness'] },
  { title: 'Trigger Protocol', fields: ['triggerMedicationType', 'triggerToRetrievalInterval', 'flushingMediaUsed'] },
  { title: 'Post-Procedure', fields: ['ovarianHyperstimulationRisk', 'proceduralComplications', 'estimatedBloodLoss', 'postProcedurePainScore'] },
];

const DATE_FIELDS = ['procedureDate'];
const NUMBER_FIELDS = ['totalOocytesRetrieved', 'matureOocytesMII', 'immatureOocytesMI', 'germinaalVesicleOocytes', 'degeneratedOocytes', 'leftOvaryFolliclesAspirated', 'rightOvaryFolliclesAspirated', 'triggerToRetrievalInterval', 'aspirationPressure', 'procedureDuration', 'endometrialThickness', 'preRetrievalEstradiolLevel', 'preRetrievalProgesteroneLevel', 'antiMullerianHormoneLevel', 'antralFollicleCount', 'estimatedBloodLoss', 'postProcedurePainScore'];
const BOOLEAN_FIELDS = ['flushingMediaUsed'];
const ARRAY_FIELDS = ['proceduralComplications'];
const STRING_FIELDS = ['retrievalPhysician', 'triggerMedicationType', 'needleGauge'];
const MEANINGFUL_ZERO_FIELDS = ['totalOocytesRetrieved', 'matureOocytesMII', 'immatureOocytesMI', 'germinaalVesicleOocytes', 'degeneratedOocytes', 'postProcedurePainScore'];

// Mirror the JSX enum canonicalization so the PDF shows 'Low', not 'low'.
const ENUM_OPTIONS = {
  ovarianHyperstimulationRisk: ['Low', 'Moderate', 'High'],
  anesthesiaType: ['General', 'Regional', 'Local', 'Monitored Anesthesia Care (MAC)', 'Sedation', 'None'],
};
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { const d = new Date(dateStr.$date || dateStr); if (isNaN(d.getTime())) return String(dateStr); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg').replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
// hide-zero: extractor-sentinel 0 hidden unless a meaningful-zero field.
const numericShows = (fn, v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); if (Number.isNaN(n)) return false; if (n === 0) return MEANINGFUL_ZERO_FIELDS.includes(fn); return true; };

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,80}?):\s+([\s\S]*)/);
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
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

// A field is visible iff it has a value (numerics respect hide-zero). Mirrors the JSX.
const fieldVisible = (record, fn) => {
  const val = record[fn];
  if (NUMBER_FIELDS.includes(fn)) return numericShows(fn, val);
  if (ARRAY_FIELDS.includes(fn)) return Array.isArray(val) && val.filter(Boolean).length > 0;
  return hasVal(val);
};

// Build the rows for a STRING field: LABELED sentence → subtitle + ≥2 comma rows; UNLABELED → one whole row.
const stringRows = (text) => {
  const rows = []; let n = 1; const strip = (x) => x.replace(/[;.]+$/, '').trim();
  splitBySentence(fmtVal(text)).forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = (parts.length >= 2 ? parts : [parsed.value]).map(strip);
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(it), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

// Render ONE field as a fieldBox; sectionTitle rides inside the first visible field (anti-orphan, Rule #74).
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  const label = FIELD_LABELS[fn] || fn;
  let body;
  if (DATE_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>1. {formatDate(val)}</Text>;
  } else if (NUMBER_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>1. {safeString(fmtVal(val))}</Text>;
  } else if (BOOLEAN_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>1. {val ? 'Yes' : 'No'}</Text>;
  } else if (ENUM_FIELDS_HAS(fn)) {
    body = <Text style={styles.fieldValue}>1. {safeString(enumCanonical(fn, fmtVal(val)))}</Text>;
  } else if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : []).filter(Boolean);
    body = items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>);
  } else {
    const rows = stringRows(val);
    body = rows.map((r, i) => r.type === 'subtitle'
      ? <Text key={i} style={styles.nestedSubtitle}>{r.text}</Text>
      : <Text key={i} style={styles.listItem}>{r.num}. {r.text}</Text>);
  }
  return (
    <View key={fn} style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {body}
    </View>
  );
};
const ENUM_FIELDS_HAS = (fn) => Object.prototype.hasOwnProperty.call(ENUM_OPTIONS, fn);

const EggRetrievalProcedureDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.egg_retrieval_procedure) return Array.isArray(r.egg_retrieval_procedure) ? r.egg_retrieval_procedure : [r.egg_retrieval_procedure];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.egg_retrieval_procedure) return Array.isArray(dd.egg_retrieval_procedure) ? dd.egg_retrieval_procedure : [dd.egg_retrieval_procedure]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Egg Retrieval Procedure</Text></View>
        <Text style={styles.emptyState}>No data available</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Egg Retrieval Procedure</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Egg Retrieval Procedure ${idx + 1}`}</Text>
            {SECTION_CONFIG.map((section, sIdx) => {
              const vis = section.fields.filter(f => fieldVisible(record, f));
              if (vis.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  {vis.map((f, fi) => renderField(record, f, fi === 0 ? section.title : null))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default EggRetrievalProcedureDocumentPDFTemplate;
