/**
 * EmergencyReportsDocumentPDFTemplate.jsx
 * Box-free LETTER — Helvetica — underline hierarchy (documentTitle 26+2pt / recordTitle 19+1pt /
 * sectionTitle 16+1pt / fieldLabel 12+0.5pt #999) — Rule #74 per-field page-break.
 * Collection: emergency_reports. Mirrors the JSX 4-area structure exactly.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.5 },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { paddingBottom: 24 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 4 },
  fieldBox: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', marginBottom: 4 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 3, paddingLeft: 10 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
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
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; } // Oxford guard — don't split before and/or
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* recommendations: PERIOD-separated in some records, COMMA-separated in others → detect (mirror JSX) */
const splitListItems = (text) => {
  const s = String(text || '');
  const sents = splitBySentence(s);
  if (sents.length >= 2) return sents.map(x => x.replace(/[;.]+$/, '').trim()).filter(Boolean);
  return splitByComma(s);
};

/* ═══ SECTION CONFIG — mirrors JSX SECTION_FIELDS exactly ═══ */
const SECTIONS = [
  { title: 'Report Information', fields: [
    { key: 'reportDate', label: 'Report Date', isDate: true },
    { key: 'reportType', label: 'Report Type' },
    { key: 'urgency', label: 'Urgency' },
  ] },
  { title: 'Clinical Indication', fields: [{ key: 'clinicalIndication', label: 'Clinical Indication', isList: true }] },
  { title: 'Findings', fields: [{ key: 'findings', label: 'Findings', isSentence: true }] },
  { title: 'Recommendations', fields: [{ key: 'recommendations', label: 'Recommendations', isList: true }] },
  { title: 'Follow-Up', fields: [{ key: 'followUp', label: 'Follow-Up' }] },
];

/* Build the display rows for a field value (mirrors the JSX renderers) */
const buildRows = (f, val) => {
  if (f.isSentence) {
    const sentences = splitBySentence(fmtVal(val));
    const rows = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const ci = splitByComma(parsed.value);
        if (ci.length >= 2) {
          rows.push({ type: 'subtitle', text: safeString(parsed.label) });
          ci.forEach(c => rows.push({ type: 'item', text: safeString(c), num: n++ }));
          return;
        }
        rows.push({ type: 'item', text: safeString(s), num: n++ });
        return;
      }
      const parts = splitByComma(s);
      if (parts.length >= 2) { parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); return; }
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    });
    return rows;
  }
  if (f.isList) {
    const items = splitListItems(fmtVal(val));
    if (items.length >= 2) return items.map((it, i) => ({ type: 'item', text: safeString(it), num: i + 1 }));
    return [{ type: 'value', text: safeString(fmtVal(val)) }];
  }
  if (f.isDate) return [{ type: 'value', text: formatDate(val) }];
  return [{ type: 'value', text: safeString(fmtVal(val)) }];
};

/* Rule #74: each field is its OWN flattened wrap-gated View; the section title rides INSIDE the
   first present field's View (glued, never orphaned). Boolean wrap only (?undefined breaks 4.5.1). */
const renderFieldUnit = (key, sectionTitle, label, rows) => {
  const rowCount = rows.length + (sectionTitle ? 1 : 0) + (label ? 1 : 0);
  return (
    <View key={key} style={styles.fieldBox} wrap={rowCount > 22 ? true : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      {label && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((r, i) => {
        if (r.type === 'subtitle') return <Text key={i} style={styles.nestedSubtitle}>{r.text}</Text>;
        if (r.type === 'item') return <Text key={i} style={styles.listItem}>{r.num}. {r.text}</Text>;
        return <Text key={i} style={styles.fieldValue}>{r.text}</Text>;
      })}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const EmergencyReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.emergency_reports) return Array.isArray(r.emergency_reports) ? r.emergency_reports : [r.emergency_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.emergency_reports) return Array.isArray(dd.emergency_reports) ? dd.emergency_reports : [dd.emergency_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Emergency Reports</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Emergency Reports</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Emergency Report ${idx + 1}`}</Text>
            </View>

            {SECTIONS.map(sec => {
              const present = sec.fields.filter(f => hasVal(record[f.key]));
              if (present.length === 0) return null;
              return (
                <View key={sec.title} style={styles.section}>
                  {present.map((f, i) => {
                    const rows = buildRows(f, record[f.key]);
                    const sectionTitle = i === 0 ? sec.title : null;
                    // single-field section whose label duplicates the section title → title only, no repeated fieldLabel
                    const label = f.label.toLowerCase() !== sec.title.toLowerCase() ? f.label : null;
                    return renderFieldUnit(`${sec.title}-${f.key}`, sectionTitle, label, rows);
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default EmergencyReportsDocumentPDFTemplate;
