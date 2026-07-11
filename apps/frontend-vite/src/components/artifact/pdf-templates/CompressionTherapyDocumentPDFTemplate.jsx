/**
 * CompressionTherapyDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first present field's View (anti-orphan, 6a2d6af6).
 * Sections/fields mirror the JSX + copy exactly (4-area mirror). Sentence + array fields split labeled/unlabeled
 * at >=3 commas (labeled groups restart numbering; sub-label only on a genuine >=3 split). Sentinel-0 numbers
 * hidden. Collection: compression_therapy
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginBottom: 3, marginTop: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_DEFS = [
  ['Garment Information', ['compressionGarmentType', 'compressionClass', 'anklePressureMmHg', 'pressureGradient', 'compressionBandageLayers', 'compressionDurationWeeks']],
  ['Vascular Assessment', ['ankleBrachialIndex', 'toeBrachialIndex', 'venousRefillTime', 'ceapClassification', 'duplexUltrasoundFindings', 'venousClaudication']],
  ['Clinical Status', ['edemaGrading', 'lymphedemaStaging', 'skinIntegrity', 'lipodermatosclerosis', 'venousUlceration', 'mobilityStatus']],
  ['Measurements', ['limbCircumferenceMeasurements', 'adverseReactions', 'contraindications']],
  ['Response', ['therapeuticResponse', 'compressionTherapyCompliance']],
];
const FIELD_LABELS = {
  compressionGarmentType: 'Garment Type', compressionClass: 'Compression Class',
  anklePressureMmHg: 'Ankle Pressure (mmHg)', pressureGradient: 'Pressure Gradient',
  compressionBandageLayers: 'Bandage Layers', compressionDurationWeeks: 'Duration (Weeks)',
  ankleBrachialIndex: 'Ankle-Brachial Index', toeBrachialIndex: 'Toe-Brachial Index',
  venousRefillTime: 'Venous Refill Time', ceapClassification: 'CEAP Classification',
  duplexUltrasoundFindings: 'Duplex Ultrasound Findings', venousClaudication: 'Venous Claudication',
  edemaGrading: 'Edema Grading', lymphedemaStaging: 'Lymphedema Staging',
  skinIntegrity: 'Skin Integrity', lipodermatosclerosis: 'Lipodermatosclerosis',
  venousUlceration: 'Venous Ulceration', mobilityStatus: 'Mobility Status',
  limbCircumferenceMeasurements: 'Limb Circumference Measurements',
  adverseReactions: 'Adverse Reactions', contraindications: 'Contraindications',
  therapeuticResponse: 'Therapeutic Response', compressionTherapyCompliance: 'Compliance',
};
const SENTENCE_FIELDS = ['duplexUltrasoundFindings'];
const ARRAY_FIELDS = ['limbCircumferenceMeasurements', 'adverseReactions', 'contraindications'];
const NUMBER_FIELDS = ['ankleBrachialIndex', 'toeBrachialIndex', 'anklePressureMmHg', 'compressionDurationWeeks', 'venousRefillTime', 'compressionBandageLayers'];
const HIDE_ZERO_FIELDS = ['ankleBrachialIndex', 'toeBrachialIndex', 'anklePressureMmHg', 'compressionDurationWeeks', 'venousRefillTime', 'compressionBandageLayers'];

const safeString = (v) => { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'Yes' : 'No'; return String(v); };
const safeArray = (v) => { if (!v) return []; return Array.isArray(v) ? v : [v]; };
const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
// 0 is a sentinel ("not measured/not applied") for these physical measurements — hide it (mirrors JSX). Booleans safe (not in HIDE_ZERO_FIELDS).
const hasFieldVal = (fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && Number(v) === 0) return false; return hasVal(v); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mmHg".
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
// Paren-aware; keeps Oxford ", and/or X" attached; skips no-space commas ("$18,000") and date commas.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#>-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

// Build a field's display lines ({k:'label'|'sub'|'row', t}) or null when empty. Mirrors the JSX + copy.
const buildFieldLines = (record, f, title) => {
  const val = record[f];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== title.toLowerCase();
  const lines = [];
  // Sub-label only on a genuine >=3 split; otherwise the whole sentence/item (incl any "Label:") is one row.
  const emitList = (arr) => {
    let n = 0;
    arr.forEach(item => {
      const p = parseLabel(String(item));
      const content = p ? p.content : String(item).replace(/[.;]+$/, '').trim();
      const c = splitByComma(content);
      if (c.length >= 3) { if (p) { lines.push({ k: 'sub', t: p.label }); n = 0; } c.forEach(part => lines.push({ k: 'row', t: `${++n}. ${part.replace(/[.;]+$/, '').trim()}` })); }
      else lines.push({ k: 'row', t: `${++n}. ${String(item).replace(/[.;]+$/, '').trim()}` });
    });
  };
  if (ARRAY_FIELDS.includes(f)) {
    const arr = safeArray(val).filter(hasVal);
    if (arr.length === 0) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    emitList(arr);
  } else if (SENTENCE_FIELDS.includes(f)) {
    if (!hasFieldVal(f, val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    emitList(splitBySentence(safeString(val)));
  } else {
    if (!hasFieldVal(f, val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${safeString(val)}` });
  }
  return lines.length ? lines : null;
};

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View.
   Threshold 20 keeps short fields whole (no title/sub-label orphans); long lists flow. */
const renderFieldView = (lines, title, isFirst, keyId) => (
  <View key={keyId} style={styles.fieldUnit} wrap={lines.length > 20 ? true : false}>
    {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    {lines.map((ln, i) => {
      if (ln.k === 'label') return <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>;
      if (ln.k === 'sub') return <Text key={i} style={styles.subLabel}>{ln.t}</Text>;
      return <Text key={i} style={styles.listItem}>{ln.t}</Text>;
    })}
  </View>
);

const renderSection = (record, title, fields) => {
  const units = fields.map(f => buildFieldLines(record, f, title)).filter(Boolean);
  if (units.length === 0) return null;
  return <View key={title} style={styles.section}>{units.map((lines, i) => renderFieldView(lines, title, i === 0, `${title}-${i}`))}</View>;
};

const CompressionTherapyDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.compression_therapy) return Array.isArray(r.compression_therapy) ? r.compression_therapy : [r.compression_therapy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.compression_therapy) return Array.isArray(dd.compression_therapy) ? dd.compression_therapy : [dd.compression_therapy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Compression Therapy</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Compression Therapy</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Compression Therapy ${idx + 1}`}</Text>
              {(record.date || record.createdAt) ? <Text style={styles.recordMeta}>{formatDate(record.date || record.createdAt)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => renderSection(record, title, fields))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CompressionTherapyDocumentPDFTemplate;
