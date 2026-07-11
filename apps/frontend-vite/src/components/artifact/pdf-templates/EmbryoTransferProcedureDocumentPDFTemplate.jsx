/**
 * EmbryoTransferProcedureDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: hide-zero sentinel numerics,
 * enum canonical, sentence parseLabel, number+unit labels. Collection: embryo_transfer_procedure
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
  transferDate: 'Transfer Date', embryologistName: 'Embryologist Name', numberOfEmbryosTransferred: 'Number of Embryos Transferred',
  embryoDevelopmentStage: 'Embryo Development Stage', gardnerGradingScore: 'Gardner Grading Score', embryoQualityGrade: 'Embryo Quality Grade',
  innerCellMassGrade: 'Inner Cell Mass Grade', trophectodermGrade: 'Trophectoderm Grade',
  catheterType: 'Catheter Type', transferTechniqueType: 'Transfer Technique Type', ultrasoundGuidanceUsed: 'Ultrasound Guidance Used',
  catheterLoadingTechnique: 'Catheter Loading Technique', trialTransferPerformed: 'Trial Transfer Performed',
  endometrialThicknessMm: 'Endometrial Thickness (mm)', endometrialPattern: 'Endometrial Pattern',
  embryoPlacementDistanceFromFundusCm: 'Embryo Placement Distance from Fundus (cm)',
  transferDifficultyScore: 'Transfer Difficulty Score', cervicalMucusRemoved: 'Cervical Mucus Removed',
  retainedEmbryosOnCatheter: 'Retained Embryos on Catheter', bloodOnCatheterTip: 'Blood on Catheter Tip', mucusOnCatheterTip: 'Mucus on Catheter Tip',
  preimplantationGeneticTestingPerformed: 'Preimplantation Genetic Testing Performed', pgtResult: 'PGT Result', assistedHatchingPerformed: 'Assisted Hatching Performed',
  embryoCryopreservationMethod: 'Embryo Cryopreservation Method', progesteroneSupportProtocol: 'Progesterone Support Protocol',
  estrogenLevelOnTransferDayPgMl: 'Estrogen Level on Transfer Day (pg/mL)', progesteroneLevelOnTransferDayNgMl: 'Progesterone Level on Transfer Day (ng/mL)',
  betaHcgTestDate: 'Beta hCG Test Date', procedureComplications: 'Procedure Complications',
};

const SECTION_CONFIG = [
  { title: 'Transfer Information', fields: ['transferDate', 'embryologistName', 'numberOfEmbryosTransferred'] },
  { title: 'Embryo Assessment', fields: ['embryoDevelopmentStage', 'gardnerGradingScore', 'embryoQualityGrade', 'innerCellMassGrade', 'trophectodermGrade'] },
  { title: 'Transfer Technique', fields: ['catheterType', 'transferTechniqueType', 'ultrasoundGuidanceUsed', 'catheterLoadingTechnique', 'trialTransferPerformed'] },
  { title: 'Endometrial Assessment', fields: ['endometrialThicknessMm', 'endometrialPattern', 'embryoPlacementDistanceFromFundusCm'] },
  { title: 'Transfer Quality', fields: ['transferDifficultyScore', 'cervicalMucusRemoved', 'retainedEmbryosOnCatheter', 'bloodOnCatheterTip', 'mucusOnCatheterTip'] },
  { title: 'Genetic Testing', fields: ['preimplantationGeneticTestingPerformed', 'pgtResult', 'assistedHatchingPerformed'] },
  { title: 'Hormonal Support', fields: ['embryoCryopreservationMethod', 'progesteroneSupportProtocol', 'estrogenLevelOnTransferDayPgMl', 'progesteroneLevelOnTransferDayNgMl'] },
  { title: 'Follow-Up', fields: ['betaHcgTestDate', 'procedureComplications'] },
];

const DATE_FIELDS = ['transferDate', 'betaHcgTestDate'];
const NUMBER_FIELDS = ['numberOfEmbryosTransferred', 'endometrialThicknessMm', 'embryoPlacementDistanceFromFundusCm', 'estrogenLevelOnTransferDayPgMl', 'progesteroneLevelOnTransferDayNgMl'];
const BOOLEAN_FIELDS = ['ultrasoundGuidanceUsed', 'trialTransferPerformed', 'cervicalMucusRemoved', 'retainedEmbryosOnCatheter', 'bloodOnCatheterTip', 'mucusOnCatheterTip', 'preimplantationGeneticTestingPerformed', 'assistedHatchingPerformed'];
const ARRAY_FIELDS = ['procedureComplications'];
const STRING_FIELDS = ['embryologistName', 'gardnerGradingScore', 'catheterLoadingTechnique', 'transferDifficultyScore', 'progesteroneSupportProtocol'];
const MEANINGFUL_ZERO_FIELDS = ['numberOfEmbryosTransferred'];

// Mirror the JSX enum canonicalization so the PDF shows 'Vitrification', not 'vitrification'.
const ENUM_OPTIONS = {
  embryoDevelopmentStage: ['Cleavage', 'Morula', 'Early Blastocyst', 'Blastocyst', 'Expanded Blastocyst', 'Hatching Blastocyst', 'Hatched Blastocyst'],
  embryoQualityGrade: ['Excellent', 'Good', 'Fair', 'Poor'],
  innerCellMassGrade: ['A', 'B', 'C'],
  trophectodermGrade: ['A', 'B', 'C'],
  catheterType: ['Edwards-Wallace', 'Cook', 'Wallace', 'Cook Soft-Trans', 'Frydman', 'Tefcat', 'Sydney IVF'],
  transferTechniqueType: ['Fresh Embryo Transfer', 'Frozen Embryo Transfer (FET)'],
  endometrialPattern: ['Trilaminar', 'Homogeneous', 'Intermediate'],
  pgtResult: ['Euploid', 'Aneuploid', 'Mosaic', 'No Result', 'Inconclusive', 'Not Tested'],
  embryoCryopreservationMethod: ['Vitrification', 'Slow Freezing', 'Fresh (Not Cryopreserved)'],
};
const ENUM_FIELDS_HAS = (fn) => Object.prototype.hasOwnProperty.call(ENUM_OPTIONS, fn);
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

// Render ONE field as a fieldBox; sectionTitle rides inside the first visible field (anti-orphan).
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

const EmbryoTransferProcedureDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.embryo_transfer_procedure) return Array.isArray(r.embryo_transfer_procedure) ? r.embryo_transfer_procedure : [r.embryo_transfer_procedure];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.embryo_transfer_procedure) return Array.isArray(dd.embryo_transfer_procedure) ? dd.embryo_transfer_procedure : [dd.embryo_transfer_procedure]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Embryo Transfer Procedure</Text></View>
        <Text style={styles.emptyState}>No data available</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Embryo Transfer Procedure</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Embryo Transfer Procedure ${idx + 1}`}</Text>
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

export default EmbryoTransferProcedureDocumentPDFTemplate;
