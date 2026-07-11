/**
 * EmgReportsDocumentPDFTemplate.jsx
 * Box-free LETTER — Helvetica — underline hierarchy (documentTitle 26+2pt / recordTitle 19+1pt /
 * sectionTitle 16+1pt / fieldLabel 12+0.5pt #999) — Rule #74 per-field page-break.
 * Collection: emg_reports. Mirrors the JSX 4-area structure exactly (Session Information first).
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
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  objectRow: { fontSize: 13, lineHeight: 1.4, color: '#000000', marginBottom: 2 },
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

const humanizeKey = (key) => {
  if (!key) return '';
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
};

// Paren-aware sentence split on a TOP-LEVEL [.;] followed by whitespace (mirror JSX) — an in-paren clause
// "(R: 38 m/s, L: 34 m/s; normal >50 m/s)" or a decimal "3.4 ms" never shatters. Abbrev-guarded for '.'.
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const ABBR = /(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i;
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    const boundary = depth === 0 && /[.;]/.test(ch) && (i + 1 >= text.length || /\s/.test(text[i + 1]))
      && !(ch === '.' && ABBR.test((cur.match(/(\S+)$/) || [''])[0]));
    if (boundary) { const t = cur.trim(); if (t && !/^[;.,!?]+$/.test(t)) out.push(t); cur = ''; }
    else cur += ch;
  }
  const t = cur.trim(); if (t && !/^[;.,!?]+$/.test(t)) out.push(t);
  return out;
};

/* parenthesis-aware comma split with Oxford (and/or) guard — mirror JSX */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; } // Oxford guard
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    } else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* Flatten a dynamic-key object into page-sized "leaf-group" units so each can be its OWN wrap=false View
   (Rule #74 — a single huge wrap=false object would overflow a page; a wrap=true object would orphan its
   section title). A unit = the run of consecutive SCALAR children at one path (record order preserved),
   carrying its ancestor path as subtitle labels. Nested objects recurse into deeper units. */
const flattenObjectUnits = (value, path = []) => {
  const units = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      if (item && typeof item === 'object') units.push(...flattenObjectUnits(item, [...path, `${i + 1}.`]));
      else if (hasVal(item)) units.push({ path, rows: [{ label: null, value: fmtVal(item) }] });
    });
    return units;
  }
  if (value && typeof value === 'object') {
    let pending = [];
    const flush = () => { if (pending.length) { units.push({ path, rows: pending }); pending = []; } };
    Object.entries(value).forEach(([k, v]) => {
      if (!hasVal(v)) return;
      if (v && typeof v === 'object') { flush(); units.push(...flattenObjectUnits(v, [...path, humanizeKey(k)])); }
      else pending.push({ label: humanizeKey(k), value: fmtVal(v) });
    });
    flush();
    return units;
  }
  if (hasVal(value)) units.push({ path, rows: [{ label: null, value: fmtVal(value) }] });
  return units;
};

/* ═══ SECTION CONFIG — mirrors JSX SECTION_FIELDS exactly ═══ */
const SECTIONS = [
  { title: 'Session Information', fields: [{ key: 'date', label: 'Date', isDate: true }, { key: 'neurologist', label: 'Neurologist' }] },
  { title: 'Indication', fields: [{ key: 'indication', label: 'Indication', isSentence: true }] },
  { title: 'Muscles Tested', fields: [{ key: 'musclesTested', label: 'Muscles Tested', isArray: true }] },
  { title: 'Nerve Conduction', fields: [{ key: 'nerveConduction', label: 'Nerve Conduction', isObject: true }] },
  { title: 'Needle Examination', fields: [{ key: 'needleExamination', label: 'Needle Examination', isObject: true }] },
  { title: 'Findings', fields: [{ key: 'findings', label: 'Findings', isSentence: true }] },
  { title: 'Interpretation', fields: [{ key: 'interpretation', label: 'Interpretation', isSentence: true }] },
];

/* Build the flat display rows for a non-object field (mirrors the JSX renderers + Copy) */
const buildRows = (f, val) => {
  if (f.isDate) return [{ type: 'item', num: 1, text: formatDate(val) }];
  if (f.isArray) {
    const arr = Array.isArray(val) ? val : [];
    return arr.filter(hasVal).map((it, i) => ({ type: 'item', num: i + 1, text: safeString(it) }));
  }
  if (f.isSentence) {
    const sentences = splitBySentence(fmtVal(val));
    const rows = []; let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        const ci = splitByComma(parsed.value);
        if (ci.length >= 2) ci.forEach(c => rows.push({ type: 'item', num: n++, text: safeString(c) }));
        else rows.push({ type: 'item', num: n++, text: safeString(parsed.value) });
        return;
      }
      rows.push({ type: 'item', num: n++, text: safeString(s) });
    });
    return rows;
  }
  return [{ type: 'item', num: 1, text: safeString(fmtVal(val)) }];
};

/* Render a dynamic object as a sequence of leaf-group units, each its OWN wrap=false View (Rule #74).
   A path segment prints only when it changes from the previous unit; the section title rides on the FIRST
   unit's View (glued, never orphaned). Key + value are STACKED — never side-by-side "Key: value" — mirroring
   the JSX display + the Copy lines, so the render-and-read Copy===PDF token sequence matches. */
const renderObjectFieldUnits = (keyBase, sectionTitle, value) => {
  const units = flattenObjectUnits(value);
  const out = []; let prev = [];
  units.forEach((u, ui) => {
    let common = 0;
    while (common < prev.length && common < u.path.length && prev[common] === u.path[common]) common++;
    const newSegs = u.path.slice(common);
    out.push(
      <View key={`${keyBase}-${ui}`} style={styles.fieldBox} wrap={false}>
        {ui === 0 && sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
        {newSegs.map((s, si) => (
          <Text key={`p${si}`} style={[styles.nestedSubtitle, { paddingLeft: (common + si) * 12 }]}>{s}</Text>
        ))}
        {u.rows.map((r, ri) => (
          r.label
            ? (
              <View key={`r${ri}`}>
                <Text style={[styles.nestedSubtitle, { paddingLeft: u.path.length * 12 }]}>{r.label}</Text>
                <Text style={[styles.listItem, { paddingLeft: (u.path.length + 1) * 12 }]}>{safeString(r.value)}</Text>
              </View>
            )
            : <Text key={`r${ri}`} style={[styles.listItem, { paddingLeft: u.path.length * 12 }]}>{safeString(r.value)}</Text>
        ))}
      </View>
    );
    prev = u.path;
  });
  return out;
};

/* Rule #74: each field is its OWN flattened wrap-gated View; the section title rides INSIDE the first
   present field's View (glued, never orphaned). Boolean wrap only (?undefined breaks 4.5.1). */
const renderRowFieldUnit = (key, sectionTitle, label, rows) => {
  const rowCount = rows.length + (sectionTitle ? 1 : 0) + (label ? 1 : 0);
  return (
    <View key={key} style={styles.fieldBox} wrap={rowCount > 22 ? true : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      {label && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((r, i) => (
        r.type === 'subtitle'
          ? <Text key={i} style={styles.nestedSubtitle}>{r.text}:</Text>
          : <Text key={i} style={styles.listItem}>{r.num}. {r.text}</Text>
      ))}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const EmgReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.emg_reports) return Array.isArray(r.emg_reports) ? r.emg_reports : [r.emg_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.emg_reports) return Array.isArray(dd.emg_reports) ? dd.emg_reports : [dd.emg_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>EMG Reports</Text></View>
          <Text style={styles.emptyState}>No EMG reports available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>EMG Reports</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`EMG Report ${idx + 1}`}</Text>
            </View>

            {SECTIONS.map(sec => {
              const present = sec.fields.filter(f => hasVal(record[f.key]));
              if (present.length === 0) return null;
              return (
                <View key={sec.title} style={styles.section}>
                  {present.map((f, i) => {
                    const sectionTitle = i === 0 ? sec.title : null;
                    // single-name gate: a field whose label duplicates the section title → title only, no fieldLabel
                    const label = f.label.toLowerCase() !== sec.title.toLowerCase() ? f.label : null;
                    if (f.isObject) return renderObjectFieldUnits(`${sec.title}-${f.key}`, sectionTitle, record[f.key]);
                    return renderRowFieldUnit(`${sec.title}-${f.key}`, sectionTitle, label, buildRows(f, record[f.key]));
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

export default EmgReportsDocumentPDFTemplate;
