/**
 * FecalCalprotectinDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — BLACK & WHITE ONLY (#000000, no color/no boxes)
 * Data collection: fecal_calprotectin
 *
 * Box-free — underlines only (documentTitle 2pt, sectionTitle 1pt black, fieldLabel 0.5pt #999).
 * Rule #74 — sections are wrap={false} atomic blocks; sectionTitle rides INSIDE the section View
 * as its first child (never an orphaned sibling). splitBySentence splits on [.;].
 * ZERO_SENTINEL_FIELDS (harveyBradshawIndex = Crohn's index N/A for UC; fecalLactoferrin 0 impossible
 * amid severe active inflammation) are hidden — mirrors JSX + Copy. No clinical date except collectionDate
 * (createdAt/updatedAt ingestion are never rendered). PHI footer is STATIC ONLY (a dynamic page-number
 * render callback crashes react-pdf 4.5.1 on 3+ pages).
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
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const ZERO_SENTINEL_FIELDS = ['harveyBradshawIndex', 'fecalLactoferrin'];

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : (typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val));
  return str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
};
const hasStr = (v) => { if (v === null || v === undefined) return false; if (typeof v === 'string') return v.trim() !== ''; if (typeof v === 'number') return true; if (typeof v === 'boolean') return true; return String(v).trim() !== ''; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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
  if (!text) return [];
  const s = String(text); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) {
      const nx = s[i + 1] || ''; const nextWord = s.slice(i + 1).trim().split(/\s+/)[0] || '';
      if (/\d/.test(nx.trim()) || /^(and|or)\b/i.test(nextWord)) { cur += ch; }
      else { const t = cur.trim(); if (t) out.push(t); cur = ''; }
    } else cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : [String(text)];
};

/* is a field a hidden zero-sentinel? */
const isSentinelHidden = (fn, val) => ZERO_SENTINEL_FIELDS.includes(fn) && Number(val) === 0;

/* one labeled scalar field: standalone label + value below */
const Field = ({ label, value }) => (hasStr(value) ? (
  <View>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
  </View>
) : null);

/* sentence field → labeled numbered rows */
const sentenceField = (label, text) => {
  if (!hasStr(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;
  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      rows.push(<Text key={`h${n}`} style={styles.fieldLabel}>{safeString(parsed.label)}</Text>);
      items.forEach((ci, i) => rows.push(<Text key={`h${n}-${i}`} style={styles.listItem}>{i + 1}. {safeString(ci)}</Text>));
    } else {
      rows.push(<Text key={`r${n}`} style={styles.listItem}>{n}. {safeString(s.replace(/[;.]+$/, '').trim())}</Text>);
      n += 1;
    }
  });
  return (
    <View key={label}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows}
    </View>
  );
};

/* array field with its own label (not single-name): label + numbered rows */
const arrayField = (label, arr) => {
  const items = Array.isArray(arr) ? arr.filter(hasStr) : [];
  if (items.length === 0) return null;
  return (
    <View key={label}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(String(it))}</Text>)}
    </View>
  );
};

/* string field: guarded comma-split (sentence-then-comma) into numbered rows; plain value if a single item */
const textField = (label, value) => {
  if (!hasStr(value)) return null;
  const items = [];
  splitBySentence(fmtVal(value)).forEach(s => { const p = parseLabel(s); (p.isLabeled ? splitByComma(p.value) : splitByComma(s)).forEach(x => items.push(x)); });
  const clean = items.map(x => safeString(String(x).replace(/[;.]+$/, '').trim())).filter(Boolean);
  if (clean.length <= 1) {
    return (
      <View key={label}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{clean[0] || safeString(fmtVal(value))}</Text>
      </View>
    );
  }
  return (
    <View key={label}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {clean.map((c, i) => <Text key={i} style={styles.listItem}>{i + 1}. {c}</Text>)}
    </View>
  );
};

const FecalCalprotectinDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.fecal_calprotectin) return Array.isArray(r.fecal_calprotectin) ? r.fecal_calprotectin : [r.fecal_calprotectin];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.fecal_calprotectin) return Array.isArray(dd.fecal_calprotectin) ? dd.fecal_calprotectin : [dd.fecal_calprotectin]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Fecal Calprotectin</Text>
          <Text style={styles.noDataText}>No fecal calprotectin records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Fecal Calprotectin</Text>
        {records.map((record, idx) => {
          const num = (fn) => (isSentinelHidden(fn, record[fn]) ? '' : record[fn]);
          const meds = Array.isArray(record.concurrentMedications) ? record.concurrentMedications.filter(hasStr) : [];

          const testResults = [
            <Field key="cl" label="Calprotectin Level" value={record.calprotectinLevel} />,
            textField('Reference Range', record.referenceRange),
            textField('Interpretation Category', record.interpretationCategory),
            hasStr(record.collectionDate) ? <Field key="cd" label="Collection Date" value={formatDate(record.collectionDate)} /> : null,
            textField('Laboratory Method', record.laboratoryMethod),
          ].filter(Boolean);
          const clinicalContext = [
            textField('Clinical Indication', record.clinicalIndication),
            textField('IBD Type', record.ibdType),
            textField('Montreal Classification', record.montrealClassification),
            textField('Stool Consistency', record.stoolConsistency),
            textField('Symptoms Severity', record.symptomsSeverity),
          ].filter(Boolean);
          const scoring = [
            <Field key="hb" label="Harvey-Bradshaw Index" value={num('harveyBradshawIndex')} />,
            <Field key="ms" label="Mayo Score" value={record.mayoScore} />,
            record.clinicalRemissionStatus !== undefined && record.clinicalRemissionStatus !== null
              ? <Field key="cr" label="Clinical Remission Status" value={record.clinicalRemissionStatus ? 'Yes' : 'No'} /> : null,
          ].filter(Boolean);
          const laboratory = [
            <Field key="crp" label="C-Reactive Protein" value={record.cReactiveProtein} />,
            <Field key="fl" label="Fecal Lactoferrin" value={num('fecalLactoferrin')} />,
            arrayField('Pre-Analytical Factors', record.preAnalyticalFactors),
          ].filter(Boolean);
          const correlation = [
            textField('Endoscopy Correlation', record.endoscopyCorrelation),
            textField('Treatment Response', record.treatmentResponse),
            arrayField('Previous Calprotectin Levels', record.previousCalprotectinLevels),
          ].filter(Boolean);

          const section = (title, children) => (children.length > 0 ? (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>{title}</Text>
              {children}
            </View>
          ) : null);

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>Fecal Calprotectin {idx + 1}</Text>
              {section('Test Results', testResults)}
              {section('Clinical Context', clinicalContext)}
              {section('Disease Activity Scoring', scoring)}
              {section('Laboratory Markers', laboratory)}
              {/* Concurrent Medications — single-name: section title + numbered list only */}
              {meds.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Concurrent Medications</Text>
                  {meds.map((m, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(String(m))}</Text>)}
                </View>
              )}
              {section('Correlation & Response', correlation)}
            </View>
          );
        })}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FecalCalprotectinDocumentPDFTemplate;
