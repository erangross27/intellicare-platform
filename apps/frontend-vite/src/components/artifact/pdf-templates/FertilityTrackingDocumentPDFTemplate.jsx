/**
 * FertilityTrackingDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: zero-sentinel numerics hidden,
 * values numbered ('1.' even singles), single-name label gate. Collection: fertility_tracking
 *
 * Sections are atomic field blocks (wrap={false}); the sectionTitle rides INSIDE the first visible field's
 * View (anti-orphan, Rule #74). splitBySentence splits on [.;]. Zero = extractor-sentinel / not-documented
 * metrics (basal body temp, dominant follicle size, insulin-resistance index, intercourse frequency, and the
 * sperm-parameter metrics — male-partner analysis absent from this female tracking record) are hidden,
 * mirroring JSX + Copy. createdAt/updatedAt (ingestion) are never rendered. PHI footer is STATIC only.
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
  menstrualCycleLength: 'Menstrual Cycle Length',
  basalBodyTemperature: 'Basal Body Temperature',
  ovulationPredictorKitResult: 'Ovulation Predictor Kit Result',
  luteinizingHormoneLevel: 'Luteinizing Hormone Level',
  follicleStimulatingHormoneLevel: 'Follicle Stimulating Hormone Level',
  estrogenLevel: 'Estrogen Level',
  progesteroneLevel: 'Progesterone Level',
  anitalMullerianhormoneLevel: 'Anti-Mullerian Hormone Level',
  thyroidStimulatingHormone: 'Thyroid Stimulating Hormone',
  prolactinLevel: 'Prolactin Level',
  testosteroneLevel: 'Testosterone Level',
  insulinResistanceIndex: 'Insulin Resistance Index',
  cervicalMucusConsistency: 'Cervical Mucus Consistency',
  cervicalPosition: 'Cervical Position',
  cervicalFirmness: 'Cervical Firmness',
  cervicalOpening: 'Cervical Opening',
  antalFollicleCount: 'Antral Follicle Count',
  endometrialThickness: 'Endometrial Thickness',
  dominantFollicleSize: 'Dominant Follicle Size',
  spermConcentration: 'Sperm Concentration',
  spermMotility: 'Sperm Motility',
  spermMorphology: 'Sperm Morphology',
  intercourseFrequency: 'Intercourse Frequency',
};

const SECTION_CONFIG = [
  { title: 'Cycle Tracking', fields: ['menstrualCycleLength', 'basalBodyTemperature', 'ovulationPredictorKitResult'] },
  { title: 'Hormone Levels', fields: ['luteinizingHormoneLevel', 'follicleStimulatingHormoneLevel', 'estrogenLevel', 'progesteroneLevel', 'anitalMullerianhormoneLevel', 'thyroidStimulatingHormone', 'prolactinLevel', 'testosteroneLevel', 'insulinResistanceIndex'] },
  { title: 'Cervical Assessment', fields: ['cervicalMucusConsistency', 'cervicalPosition', 'cervicalFirmness', 'cervicalOpening'] },
  { title: 'Ovarian & Uterine', fields: ['antalFollicleCount', 'endometrialThickness', 'dominantFollicleSize'] },
  { title: 'Sperm Parameters', fields: ['spermConcentration', 'spermMotility', 'spermMorphology', 'intercourseFrequency'] },
];

const BOOLEAN_FIELDS = ['ovulationPredictorKitResult'];
const NUMBER_FIELDS = ['menstrualCycleLength', 'basalBodyTemperature', 'luteinizingHormoneLevel', 'follicleStimulatingHormoneLevel', 'estrogenLevel', 'progesteroneLevel', 'anitalMullerianhormoneLevel', 'thyroidStimulatingHormone', 'prolactinLevel', 'testosteroneLevel', 'insulinResistanceIndex', 'antalFollicleCount', 'endometrialThickness', 'dominantFollicleSize', 'spermConcentration', 'spermMotility', 'spermMorphology', 'intercourseFrequency'];
const STRING_FIELDS = ['cervicalMucusConsistency', 'cervicalPosition', 'cervicalFirmness', 'cervicalOpening'];
// zero = extractor-sentinel / not-documented (mirror the JSX) → hidden
const ZERO_SENTINEL_FIELDS = ['basalBodyTemperature', 'dominantFollicleSize', 'insulinResistanceIndex', 'intercourseFrequency', 'spermConcentration', 'spermMotility', 'spermMorphology'];

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
// hide-zero: extractor-sentinel 0 hidden for the not-documented / N-A metrics.
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
// The field label is suppressed when it equals the section title (single-name gate).
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = !sectionTitle || label.toLowerCase() !== sectionTitle.toLowerCase();
  let body;
  if (NUMBER_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>1. {safeString(fmtVal(val))}</Text>;
  } else if (BOOLEAN_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>1. {val ? 'Yes' : 'No'}</Text>;
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

const FertilityTrackingDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.fertility_tracking) return Array.isArray(r.fertility_tracking) ? r.fertility_tracking : [r.fertility_tracking];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.fertility_tracking) return Array.isArray(dd.fertility_tracking) ? dd.fertility_tracking : [dd.fertility_tracking]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fertility Tracking</Text></View>
        <Text style={styles.emptyState}>No fertility tracking records available</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fertility Tracking</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Fertility Tracking ${idx + 1}`}</Text>
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

export default FertilityTrackingDocumentPDFTemplate;
