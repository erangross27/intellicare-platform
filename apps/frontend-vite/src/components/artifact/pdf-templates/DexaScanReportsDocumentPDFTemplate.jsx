/**
 * DexaScanReportsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dexa_scan_reports.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only; sectionTitle rides INSIDE the section's first field View.
 * Every value row numbered ("1." even singles). Sentinel zeros (extractor default for numerics
 * it could not read) are hidden exactly as in the JSX — a fabricated "Z-Score 0" reads as a
 * REAL densitometry result.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const nextTrim = rest.trimStart();
      const noSpace = rest.charAt(0) !== ' ';
      const andOr = /(?:^|\s)(?:and|or)$/i.test(current.trimEnd()) || /^(?:and|or)\b/i.test(nextTrim);
      const badNext = !/^[A-Za-z>(]/.test(nextTrim.charAt(0) || '');
      if (noSpace || andOr || badNext) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* Sentence lines mirroring the copy builder: labeled groups restart numbering under a
   sub-label; unlabeled rows continue the running count. */
const sentenceLines = (text) => {
  const out = []; let running = 1;
  splitBySentence(text).forEach(s => {
    const parsed = parseLabel(s);
    const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
    if (!value) return;
    const parts = splitByComma(value);
    if (parsed.isLabeled) {
      out.push({ subLabel: parsed.label });
      if (parts.length >= 3) parts.forEach((item, i) => out.push({ num: i + 1, text: item }));
      else out.push({ num: 1, text: value });
    } else if (parts.length >= 3) {
      parts.forEach(item => out.push({ num: running++, text: item }));
    } else {
      out.push({ num: running++, text: value });
    }
  });
  return out;
};

/* ═══ SCHEMA (mirrors the JSX SECTION_FIELDS / FIELD_LABELS) ═══ */
const SECTIONS = [
  { title: 'T-Scores', fields: ['tScoreLumbarSpine', 'tScoreFemoralNeck', 'tScoreTotalHip'] },
  { title: 'Z-Scores', fields: ['zScoreLumbarSpine', 'zScoreFemoralNeck'] },
  { title: 'Bone Density', fields: ['boneDensityLumbarSpine', 'boneDensityFemoralNeck', 'boneDensityTotalHip', 'totalBodyBoneDensity'] },
  { title: 'WHO Classification & Fracture Risk', fields: ['whoClassification', 'fracRiskMajor10Year', 'fracRiskHip10Year'] },
  { title: 'Vertebral Fractures', fields: ['vertebralFracturesPresent', 'vertebralFractureGrade'] },
  { title: 'Body Composition', fields: ['bodyCompositionAnalyzed', 'leanBodyMass', 'bodyFatPercentage'] },
  { title: 'Scan Quality & Follow-up', fields: ['scanQuality', 'artifactsPresent', 'treatmentRecommended', 'followUpInterval', 'priorDexaScanDate', 'boneDensityChangePercent', 'leastSignificantChange'] },
];

const FIELD_LABELS = {
  tScoreLumbarSpine: 'T-Score Lumbar Spine',
  tScoreFemoralNeck: 'T-Score Femoral Neck',
  tScoreTotalHip: 'T-Score Total Hip',
  zScoreLumbarSpine: 'Z-Score Lumbar Spine',
  zScoreFemoralNeck: 'Z-Score Femoral Neck',
  boneDensityLumbarSpine: 'Bone Density Lumbar Spine',
  boneDensityFemoralNeck: 'Bone Density Femoral Neck',
  boneDensityTotalHip: 'Bone Density Total Hip',
  totalBodyBoneDensity: 'Total Body Bone Density',
  whoClassification: 'WHO Classification',
  fracRiskMajor10Year: 'Major Fracture Risk (10-Year %)',
  fracRiskHip10Year: 'Hip Fracture Risk (10-Year %)',
  vertebralFracturesPresent: 'Vertebral Fractures Present',
  vertebralFractureGrade: 'Vertebral Fracture Grade',
  bodyCompositionAnalyzed: 'Body Composition Analyzed',
  leanBodyMass: 'Lean Body Mass',
  bodyFatPercentage: 'Body Fat Percentage (%)',
  scanQuality: 'Scan Quality',
  artifactsPresent: 'Artifacts Present',
  treatmentRecommended: 'Treatment Recommended',
  followUpInterval: 'Follow-up Interval (months)',
  priorDexaScanDate: 'Prior DEXA Scan Date',
  boneDensityChangePercent: 'Bone Density Change (%)',
  leastSignificantChange: 'Least Significant Change',
};

const DATE_FIELDS = ['priorDexaScanDate'];
const NUMBER_FIELDS = [
  'tScoreLumbarSpine', 'tScoreFemoralNeck', 'tScoreTotalHip',
  'zScoreLumbarSpine', 'zScoreFemoralNeck',
  'boneDensityLumbarSpine', 'boneDensityFemoralNeck', 'boneDensityTotalHip', 'totalBodyBoneDensity',
  'fracRiskMajor10Year', 'fracRiskHip10Year',
  'leanBodyMass', 'bodyFatPercentage',
  'followUpInterval', 'boneDensityChangePercent', 'leastSignificantChange',
];

/* sentinel 0 in a numeric field = "not measured" → hidden (mirrors the JSX) */
const fieldShows = (fn, v) => hasVal(v) && !(typeof v === 'number' && v === 0 && NUMBER_FIELDS.includes(fn));

/* ═══ COMPONENT ═══ */
const DexaScanReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dexa_scan_reports) return Array.isArray(r.dexa_scan_reports) ? r.dexa_scan_reports : [r.dexa_scan_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dexa_scan_reports) return Array.isArray(dd.dexa_scan_reports) ? dd.dexa_scan_reports : [dd.dexa_scan_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="DEXA Scan Reports">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>DEXA Scan Reports</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  /* one field = one glue unit; sectionTitle rides inside the FIRST field's View */
  const renderField = (record, fn, fi, sectionTitle) => {
    const label = FIELD_LABELS[fn] || fn;
    const val = record[fn];
    let rows;
    if (DATE_FIELDS.includes(fn)) {
      rows = [{ num: 1, text: formatDate(val) }];
    } else {
      const strVal = fmtVal(val);
      rows = splitBySentence(strVal).length > 1 ? sentenceLines(strVal) : [{ num: 1, text: strVal }];
    }
    return (
      <View key={fn} style={styles.fieldGroup} wrap={false}>
        {fi === 0 && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        {rows.map((r, ri) => r.subLabel
          ? <Text key={ri} style={styles.subLabel}>{safeString(r.subLabel)}</Text>
          : <Text key={ri} style={styles.value}>{`${r.num}. ${safeString(r.text)}`}</Text>)}
      </View>
    );
  };

  return (
    <Document title="DEXA Scan Reports">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>DEXA Scan Reports</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`DEXA Scan Report ${idx + 1}`}</Text>
            </View>

            {SECTIONS.map(({ title, fields }) => {
              const shown = fields.filter(f => fieldShows(f, record[f]));
              if (shown.length === 0) return null;
              return (
                <View key={title} style={styles.section}>
                  {shown.map((f, fi) => renderField(record, f, fi, title))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DexaScanReportsDocumentPDFTemplate;
