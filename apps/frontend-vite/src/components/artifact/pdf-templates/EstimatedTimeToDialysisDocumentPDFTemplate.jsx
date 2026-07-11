/**
 * EstimatedTimeToDialysisDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors EstimatedTimeToDialysisDocument.jsx sections/labels
 * exactly (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: estimated_time_to_dialysis.
 * react-pdf: wrap is BOOLEAN only; each section is one wrap-glued View so its title never orphans.
 * transplantEvaluation is narrative (sentence-split [.;] + comma-split + numbered); creatinineClearance
 * hides a stored 0 (= not assessed). Title/section/label each get a borderBottom underline (no boxes).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.5 },
  listItem: { fontSize: 14, color: '#000000', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noData: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

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
      const nextChar = rest.charAt(0);
      const restTrim = rest.replace(/^\s+/, '');
      if ((nextChar && /\d/.test(nextChar)) || /^(and|or|then)\b/i.test(restTrim) || /\b(and|or)$/i.test(current.trim())) {
        current += ch;
      } else {
        const t = current.trim(); if (t) result.push(t); current = '';
      }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ENUM none in this template. ZERO_SENTINEL — a stored 0 = "not assessed" → hidden (mirror JSX). */
const ZERO_SENTINEL = ['creatinineClearance'];

const SECTION_TITLES = {
  'kidney-function': 'Kidney Function',
  'underlying-causes': 'Underlying Causes',
  'current-therapy': 'Current Therapy',
  'lab-values': 'Lab Values',
  'access-planning': 'Access & Planning',
  'timeline': 'Timeline',
};

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'Kidney Function', fields: [
    { key: 'currentCreatinineLevel', label: 'Current Creatinine Level', type: 'number' },
    { key: 'estimatedGlomerularFiltrationRate', label: 'Estimated GFR', type: 'number' },
    { key: 'bloodUreaNitrogen', label: 'Blood Urea Nitrogen', type: 'number' },
    { key: 'chronickidneyDiseaseStage', label: 'CKD Stage' },
    { key: 'proteinuriaLevel', label: 'Proteinuria Level', type: 'number' },
    { key: 'albuminToCreatinineRatio', label: 'Albumin-to-Creatinine Ratio', type: 'number' },
    { key: 'creatinineClearance', label: 'Creatinine Clearance', type: 'number', zeroSentinel: true },
  ] },
  { title: 'Underlying Causes', fields: [
    { key: 'underlyingNephropathy', label: 'Underlying Nephropathy' },
    { key: 'diabeticNephropathy', label: 'Diabetic Nephropathy', type: 'bool' },
    { key: 'hypertensiveNephrosclerosis', label: 'Hypertensive Nephrosclerosis', type: 'bool' },
    { key: 'polycysticKidneyDisease', label: 'Polycystic Kidney Disease', type: 'bool' },
    { key: 'glomerulonephritis', label: 'Glomerulonephritis' },
  ] },
  { title: 'Current Therapy', fields: [
    { key: 'aceInhibitorTherapy', label: 'ACE Inhibitor Therapy', type: 'bool' },
    { key: 'angiotensinReceptorBlocker', label: 'Angiotensin Receptor Blocker', type: 'bool' },
  ] },
  { title: 'Lab Values', fields: [
    { key: 'hemoglobinLevel', label: 'Hemoglobin Level', type: 'number' },
    { key: 'serumPhosphorus', label: 'Serum Phosphorus', type: 'number' },
    { key: 'serumCalcium', label: 'Serum Calcium', type: 'number' },
    { key: 'parathyroidHormone', label: 'Parathyroid Hormone', type: 'number' },
    { key: 'vitaminDLevel', label: 'Vitamin D Level', type: 'number' },
    { key: 'metabolicAcidosis', label: 'Metabolic Acidosis', type: 'bool' },
  ] },
  { title: 'Access & Planning', fields: [
    { key: 'vascularAccessPlacement', label: 'Vascular Access Placement' },
    { key: 'arteriovenousFistula', label: 'Arteriovenous Fistula', type: 'bool' },
    { key: 'peritonealDialysisEligibility', label: 'Peritoneal Dialysis Eligibility', type: 'bool' },
    { key: 'transplantEvaluation', label: 'Transplant Evaluation', type: 'sentence' },
  ] },
  { title: 'Timeline', fields: [
    { key: 'estimatedTimeToDialysis', label: 'Estimated Time to Dialysis (months)', type: 'number' },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (f.type === 'number') return hasVal(v) && !((f.zeroSentinel || ZERO_SENTINEL.includes(f.key)) && Number(v) === 0);
  return hasVal(v);
};

/* renderSentenceSection: narrative field → numbered lines (mirrors JSX formatSentenceFieldLines). */
const renderSentenceSection = (label, text, key) => {
  const sentences = splitBySentence(fmtVal(text));
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) { rows.push({ type: 'sub', text: safeString(parsed.label) }); parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 2) { parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    }
  });
  if (rows.length === 0) return null;
  return (
    <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => row.type === 'sub'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* renderField: one wrap-glued View per field (label + value never split across a page). */
const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  const showLabel = (field.label || '').toLowerCase() !== (sectionTitle || '').toLowerCase();
  if (field.type === 'sentence') return renderSentenceSection(field.label, val, key);

  let display;
  if (field.type === 'bool') display = (val ? 'Yes' : 'No');
  else display = safeString(fmtVal(val));

  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      {showLabel && <Text style={styles.fieldLabel}>{field.label}</Text>}
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

const EstimatedTimeToDialysisDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.estimated_time_to_dialysis) return Array.isArray(r.estimated_time_to_dialysis) ? r.estimated_time_to_dialysis : [r.estimated_time_to_dialysis];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.estimated_time_to_dialysis) return Array.isArray(dd.estimated_time_to_dialysis) ? dd.estimated_time_to_dialysis : [dd.estimated_time_to_dialysis]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Estimated Time to Dialysis</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Estimated Time to Dialysis</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>Estimated Time to Dialysis {idx + 1}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const present = cfg.fields.filter(f => isPresent(record, f));
              if (present.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(record, present[0], cfg.title, 0)}
                  </View>
                  {present.slice(1).map((field, i) => renderField(record, field, cfg.title, i + 1))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default EstimatedTimeToDialysisDocumentPDFTemplate;
