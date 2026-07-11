/**
 * AllergyAssessmentsDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — allergy assessments
 * Collection: allergy_assessments (SINGULAR 'Allergy', plural 'Assessments')
 *
 * B&W only (#000000) — Rule #74 wrap-gating inherited from donor.
 * Fields (from unified-medical-schemas.json):
 *   date (Date), environmentalAllergens (array), totalIge (string), eosinophilCount (string),
 *   skinTestResults (array), specificIgE (object), provider (string)
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 12, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 13, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 13, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
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
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox.
   wrap={false} keeps the label glued to its value so a heading can NEVER be orphaned at a page
   break (title alone at page bottom, value on next page). A 2-line block is < 1 page, so
   wrap={false} just moves it whole to the next page — no overprint. (699004a9 title-inside) */
const renderFieldRow = (label, value, leadTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {leadTitle ? <Text style={styles.sectionTitle}>{leadTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: split string fields into numbered sentences for PDF (retained from donor) */
const renderSentenceField = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);

  if (sentences.length <= 1) {
    return renderFieldRow(label, value);
  }

  let n = 1;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            const items = [];
            items.push(<Text key={`lbl-${sIdx}`} style={styles.nestedSubtitle}>{parsed.label}:</Text>);
            commaItems.forEach((ci, ciIdx) => {
              items.push(<Text key={`${sIdx}-${ciIdx}`} style={styles.listItem}>{n++}. {ci}</Text>);
            });
            return <View key={sIdx}>{items}</View>;
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{n++}. {parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{n++}. {sentence}</Text>;
      })}
    </View>
  );
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* renderArrayBox: array field as numbered list.
   Flat label + per-item Text rows (NO wrapping <View>) so react-pdf can break BETWEEN rows
   across pages. A single <View> holding all items can't wrap and, when taller than one page,
   overflows/compresses onto one page ("Node of type VIEW can't wrap..."). Rule #74 6a2d6af6 / 6a2f7b67. */
const renderArrayBox = (label, value, leadTitle) => {
  if (!hasVal(value)) return null;
  const items = (Array.isArray(value) ? value : [value]).filter(hasVal);
  if (items.length === 0) return null;
  const fmt = (it) => (typeof it === 'object' ? JSON.stringify(it) : safeString(it));
  return (
    <React.Fragment>
      {/* GLUE: (section title) + field label + FIRST row in one wrap={false} View so the heading
          is never orphaned at a page break. Remaining rows flow as <Text> siblings so the list
          still breaks BETWEEN rows. Glue is < 1 page → wrap={false} moves it whole, no overprint. */}
      <View wrap={false}>
        {leadTitle ? <Text style={styles.sectionTitle}>{leadTitle}</Text> : null}
        <Text style={[styles.fieldLabel, leadTitle ? null : { marginTop: 6 }]}>{label}</Text>
        <Text style={styles.listItem}>1. {fmt(items[0])}</Text>
      </View>
      {items.slice(1).map((it, i) => (
        <Text key={i + 1} style={styles.listItem}>{i + 2}. {fmt(it)}</Text>
      ))}
    </React.Fragment>
  );
};

/* renderObjectBox: object field — recursive flat key/value leaves */
const renderObjectLeaves = (value, depth = 0) => {
  const out = [];
  Object.entries(value || {}).forEach(([k, v], i) => {
    if (!hasVal(v)) return;
    if (typeof v === 'object' && !Array.isArray(v) && !(v && v.$date)) {
      out.push(<Text key={`${depth}-${i}-k`} style={styles.nestedSubtitle}>{humanizeKey(k)}:</Text>);
      renderObjectLeaves(v, depth + 1).forEach(node => out.push(node));
    } else {
      const val = Array.isArray(v) ? v.map(safeString).join(', ') : safeString(v);
      out.push(<Text key={`${depth}-${i}`} style={[styles.listItem, depth > 0 ? { paddingLeft: 16 } : null]}>{humanizeKey(k)}: {val}</Text>);
    }
  });
  return out;
};

const renderObjectBox = (label, value, leadTitle) => {
  if (!hasVal(value) || typeof value !== 'object') return null;
  const leaves = renderObjectLeaves(value);
  if (leaves.length === 0) return null;
  // GLUE: (section title) + label + FIRST leaf in one wrap={false} View (heading never orphaned);
  // remaining leaves flow as siblings so the list still breaks between rows. See renderArrayBox.
  return (
    <React.Fragment>
      <View wrap={false}>
        {leadTitle ? <Text style={styles.sectionTitle}>{leadTitle}</Text> : null}
        <Text style={[styles.fieldLabel, leadTitle ? null : { marginTop: 6 }]}>{label}</Text>
        {leaves[0]}
      </View>
      {leaves.slice(1)}
    </React.Fragment>
  );
};

/* ======= MAIN COMPONENT ======= */
const AllergyAssessmentsDocumentPDFTemplate = ({ document: docProp, documents }) => {
  const records = (() => {
    if (documents && Array.isArray(documents) && documents.length > 0) return documents;
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.allergy_assessments) return Array.isArray(r.allergy_assessments) ? r.allergy_assessments : [r.allergy_assessments];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.allergy_assessments) return Array.isArray(dd.allergy_assessments) ? dd.allergy_assessments : [dd.allergy_assessments]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  })();

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No allergy assessment records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Allergy Assessments</Text>
        </View>

        {records.map((record, idx) => {
          /* Rule #74 wrap-gating: gate on the ACTUAL rendered ROW count (array items + object
             leaves + string fields), NOT the 5 top-level fields. specificIgE (object) and the
             arrays each render many rows, so the old field-count gate left a tall section as
             wrap={false} and react-pdf compressed/overprinted it onto one page. Counting real
             rows lets a large section flow to the next page (Rule #74 6a2d6af6 / 6a2f7b67). */
          const arrLen = (v) => Array.isArray(v) ? v.filter(hasVal).length : (hasVal(v) ? 1 : 0);
          const countLeaves = (o) => {
            if (!hasVal(o) || typeof o !== 'object') return 0;
            let c = 0;
            Object.values(o).forEach(v => {
              if (v && typeof v === 'object' && !Array.isArray(v) && !v.$date) c += 1 + countLeaves(v);
              else if (hasVal(v)) c += 1;
            });
            return c;
          };
          const testingRowCount =
            arrLen(record.environmentalAllergens) +
            arrLen(record.skinTestResults) +
            countLeaves(record.specificIgE) +
            (hasVal(record.totalIge) ? 1 : 0) +
            (hasVal(record.eosinophilCount) ? 1 : 0);

          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {hasVal(record.date || record.createdAt) && (
                    <Text style={styles.recordDate}>{formatDate(record.date || record.createdAt)}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>{`Allergy Assessments ${idx + 1}`}</Text>
              </View>

              {/* Visit Details Section — header date + provider */}
              {(hasVal(record.date) || hasVal(record.provider)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Visit Details</Text>
                  {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                  {renderFieldRow('Provider', record.provider)}
                </View>
              )}

              {/* Allergy Testing Section — Rule #74 wrap-gating. Section flows when tall
                  (wrap={true}, NEVER undefined → v4 treats undefined as false, memory 6a3cda8c).
                  Each field's LABEL + first row are glued in a wrap={false} View so a heading can
                  never be orphaned at a page break ("the title with one row"). The section title
                  rides INSIDE the first present field's glue — never a lone <Text> sibling
                  (a standalone title orphans; memory 699004a9 / Rule #74). */}
              {testingRowCount > 0 && (() => {
                const igeLeaves = (hasVal(record.specificIgE) && typeof record.specificIgE === 'object')
                  ? renderObjectLeaves(record.specificIgE).length : 0;
                const present = {
                  env: arrLen(record.environmentalAllergens) > 0,
                  skin: arrLen(record.skinTestResults) > 0,
                  ige: igeLeaves > 0,
                  total: hasVal(record.totalIge),
                  eos: hasVal(record.eosinophilCount),
                };
                const firstKey = ['env', 'skin', 'ige', 'total', 'eos'].find(k => present[k]);
                const T = 'Allergy Testing';
                return (
                  <View style={styles.section} wrap={testingRowCount > 8 ? true : false}>
                    {renderArrayBox('Environmental Allergens', record.environmentalAllergens, firstKey === 'env' ? T : undefined)}
                    {renderArrayBox('Skin Test Results', record.skinTestResults, firstKey === 'skin' ? T : undefined)}
                    {renderObjectBox('Specific IgE', record.specificIgE, firstKey === 'ige' ? T : undefined)}
                    {renderFieldRow('Total IgE', record.totalIge, firstKey === 'total' ? T : undefined)}
                    {renderFieldRow('Eosinophil Count', record.eosinophilCount, firstKey === 'eos' ? T : undefined)}
                  </View>
                );
              })()}

              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default AllergyAssessmentsDocumentPDFTemplate;
