/**
 * FertilityPreservationDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: zero-sentinel numerics hidden,
 * OHSS enum canonical, sentence parseLabel, values numbered ('1.' even singles). Collection: fertility_preservation
 *
 * Sections are wrap={false} atomic field blocks; the sectionTitle rides INSIDE the first visible field's View
 * (anti-orphan, Rule #74). splitBySentence splits on [.;]. Zero = extractor-sentinel/N-A metrics (baseline
 * FSH/estradiol, sperm counts for a female oocyte-freeze patient, oocytes-surviving-thaw on a fresh freeze,
 * oncofertility window) are hidden, mirroring JSX + Copy. createdAt/updatedAt (ingestion) are never rendered.
 * PHI footer is STATIC only (no dynamic page-number render — crashes react-pdf 4.5.1 at 3+ pages).
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
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const FIELD_LABELS = {
  primaryDiagnosis: 'Primary Diagnosis',
  antiMullerianHormone: 'Anti-Mullerian Hormone',
  antralFollicleCount: 'Antral Follicle Count',
  follicleStimulatingHormone: 'Follicle Stimulating Hormone',
  estradiolBaseline: 'Estradiol Baseline',
  ovarianStimulationProtocol: 'Stimulation Protocol',
  gonadotropinTotalDose: 'Gonadotropin Total Dose',
  stimulationDuration: 'Stimulation Duration',
  triggerMedicationType: 'Trigger Medication Type',
  oocytesRetrieved: 'Oocytes Retrieved',
  matureOocytesMII: 'Mature Oocytes (MII)',
  oocyteCryopreservationMethod: 'Cryopreservation Method',
  oocytesSurvivingThaw: 'Oocytes Surviving Thaw',
  embryosCryopreserved: 'Embryos Cryopreserved',
  blastocystGradingGardner: 'Blastocyst Grading (Gardner)',
  spermCryopreservationSamples: 'Cryopreservation Samples',
  spermConcentrationPreFreeze: 'Concentration Pre-Freeze',
  totalMotileSpermCount: 'Total Motile Sperm Count',
  ovarianTissueCryopreservation: 'Ovarian Tissue Cryopreservation',
  testicularTissueExtraction: 'Testicular Tissue Extraction',
  gnrhAgonistOvarianSuppression: 'GnRH Agonist Ovarian Suppression',
  oncofertilityUrgencyWindow: 'Oncofertility Urgency Window',
  gonadotoxicityRiskScore: 'Gonadotoxicity Risk Score',
  ovarianHyperstimulationSyndromeRisk: 'OHSS Risk',
  cryostorageLocation: 'Cryostorage Location',
};

const SECTION_CONFIG = [
  { title: 'Primary Diagnosis', fields: ['primaryDiagnosis'] },
  { title: 'Ovarian Reserve Assessment', fields: ['antiMullerianHormone', 'antralFollicleCount', 'follicleStimulatingHormone', 'estradiolBaseline'] },
  { title: 'Ovarian Stimulation', fields: ['ovarianStimulationProtocol', 'gonadotropinTotalDose', 'stimulationDuration', 'triggerMedicationType'] },
  { title: 'Oocyte & Embryo Preservation', fields: ['oocytesRetrieved', 'matureOocytesMII', 'oocyteCryopreservationMethod', 'oocytesSurvivingThaw', 'embryosCryopreserved', 'blastocystGradingGardner'] },
  { title: 'Sperm Preservation', fields: ['spermCryopreservationSamples', 'spermConcentrationPreFreeze', 'totalMotileSpermCount'] },
  { title: 'Tissue Preservation', fields: ['ovarianTissueCryopreservation', 'testicularTissueExtraction', 'gnrhAgonistOvarianSuppression'] },
  { title: 'Risk Assessment', fields: ['oncofertilityUrgencyWindow', 'gonadotoxicityRiskScore', 'ovarianHyperstimulationSyndromeRisk'] },
  { title: 'Storage', fields: ['cryostorageLocation'] },
];

const NUMBER_FIELDS = [
  'antiMullerianHormone', 'antralFollicleCount', 'follicleStimulatingHormone', 'estradiolBaseline',
  'gonadotropinTotalDose', 'stimulationDuration',
  'oocytesRetrieved', 'matureOocytesMII', 'oocytesSurvivingThaw', 'embryosCryopreserved',
  'spermCryopreservationSamples', 'spermConcentrationPreFreeze', 'totalMotileSpermCount',
  'oncofertilityUrgencyWindow',
];
const BOOLEAN_FIELDS = ['ovarianTissueCryopreservation', 'gnrhAgonistOvarianSuppression'];
// zero = extractor-sentinel / not-applicable (mirror the JSX) → hidden
const ZERO_SENTINEL_FIELDS = ['follicleStimulatingHormone', 'estradiolBaseline', 'oocytesSurvivingThaw', 'spermCryopreservationSamples', 'spermConcentrationPreFreeze', 'totalMotileSpermCount', 'oncofertilityUrgencyWindow'];

// Mirror the JSX enum canonicalization so the PDF shows 'Moderate', not 'moderate'.
const ENUM_OPTIONS = { ovarianHyperstimulationSyndromeRisk: ['Low', 'Moderate', 'High', 'Very High'] };
const ENUM_FIELDS_HAS = (fn) => Object.prototype.hasOwnProperty.call(ENUM_OPTIONS, fn);
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
// hide-zero: extractor-sentinel 0 hidden for the N-A metrics.
const numericShows = (fn, v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); if (Number.isNaN(n)) return false; if (n === 0) return !ZERO_SENTINEL_FIELDS.includes(fn); return true; };

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
// The field label is suppressed when it equals the section title (single-name gate — Primary Diagnosis).
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = !sectionTitle || label.toLowerCase() !== sectionTitle.toLowerCase();
  let body;
  if (NUMBER_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>1. {safeString(fmtVal(val))}</Text>;
  } else if (BOOLEAN_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>1. {val ? 'Yes' : 'No'}</Text>;
  } else if (ENUM_FIELDS_HAS(fn)) {
    body = <Text style={styles.fieldValue}>1. {safeString(enumCanonical(fn, fmtVal(val)))}</Text>;
  } else {
    const rows = stringRows(val);
    body = rows.map((r, i) => r.type === 'subtitle'
      ? <Text key={i} style={styles.nestedSubtitle}>{r.text}</Text>
      : <Text key={i} style={styles.listItem}>{r.num}. {r.text}</Text>);
  }
  return (
    <View key={fn} style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  );
};

const FertilityPreservationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.fertility_preservation) return Array.isArray(r.fertility_preservation) ? r.fertility_preservation : [r.fertility_preservation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.fertility_preservation) return Array.isArray(dd.fertility_preservation) ? dd.fertility_preservation : [dd.fertility_preservation]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fertility Preservation</Text></View>
        <Text style={styles.emptyState}>No fertility preservation records available</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fertility Preservation</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Fertility Preservation ${idx + 1}`}</Text>
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
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FertilityPreservationDocumentPDFTemplate;
