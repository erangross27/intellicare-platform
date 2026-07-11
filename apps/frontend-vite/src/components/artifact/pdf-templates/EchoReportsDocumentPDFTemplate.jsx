/**
 * EchoReportsDocumentPDFTemplate.jsx
 * Box-free black-&-white LETTER PDF (canonical): 26/19/16/12/14 pt, numbered rows, underline rules
 * (documentTitle 2pt / recordTitle+sectionTitle 1pt black / fieldLabel 0.5pt #999), break={idx>0}.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : (typeof val === 'object' ? (Object.keys(val).length === 0 ? '' : JSON.stringify(val)) : String(val));
  str = str.replace(/μ/g, 'u').replace(/µ/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/–/g, '-').replace(/—/g, '-').replace(/‘/g, "'").replace(/’/g, "'").replace(/“/g, '"').replace(/”/g, '"');
  return str;
};
const humanizeKey = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|No)\.)(?<!\b[A-Z])[.;]\s+/).map((s) => s.replace(/[.;]\s*$/, '').trim()).filter(Boolean);
};
const formatDate = (date) => {
  if (!date) return '';
  try { const d = new Date(date.$date || date); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return ''; }
};
const filterNulls = (arr) => (Array.isArray(arr) ? arr.filter((i) => i !== null && i !== undefined) : []);

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', textAlign: 'center', color: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', color: '#000000' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', color: '#000000' },
  fieldBlock: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', color: '#000000' },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, lineHeight: 1.4, paddingLeft: 8 },
});

// One field block: (optional) bold sub-label + numbered value rows. Section title rides the FIRST block.
const fieldBlock = (title, showTitle, label, showLabel, values, key) => {
  const vals = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (vals.length === 0) return null;
  return (
    <View key={key} wrap={false} style={styles.fieldBlock}>
      {showTitle && <Text style={styles.sectionTitle}>{safeString(title)}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {vals.map((v, j) => <Text key={j} style={styles.listItem}>{j + 1}. {safeString(v)}</Text>)}
    </View>
  );
};
// Build a section from an array of {label, values, showLabel} — section title rides the first non-empty block.
const section = (title, fields, keyPrefix) => {
  const out = []; let first = true;
  fields.forEach((f, i) => {
    const vals = (f.values || []).filter((v) => v !== null && v !== undefined && v !== '');
    if (vals.length === 0) return;
    out.push(fieldBlock(title, first, f.label, f.showLabel !== false, vals, `${keyPrefix}-${i}`));
    first = false;
  });
  return out;
};

const EchoReportsDocumentPDFTemplate = ({ document: doc }) => {
  const u = doc?.documentData || doc;
  let reports = [];
  if (u?.echo_reports && Array.isArray(u.echo_reports)) reports = u.echo_reports;
  else if (u?._records && Array.isArray(u._records)) reports = u._records;
  else if (u?.records && Array.isArray(u.records)) reports = u.records;
  else if (Array.isArray(u)) reports = u;
  else if (u && typeof u === 'object') reports = [u];
  const valid = filterNulls(reports);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Echocardiogram Reports</Text>
        {valid.map((r, idx) => {
          const overview = section('Overview', [
            { label: 'Date', values: r.date ? [formatDate(r.date)] : [] },
            { label: 'Ejection Fraction', values: safeString(r.ejectionFraction).trim() ? [safeString(r.ejectionFraction)] : [] },
            { label: 'Cardiologist', values: safeString(r.cardiologist).trim() ? [safeString(r.cardiologist)] : [] },
          ], `o-${idx}`);

          const objSections = [['leftVentricle', 'Left Ventricle'], ['rightVentricle', 'Right Ventricle'], ['leftAtrium', 'Left Atrium'], ['rightAtrium', 'Right Atrium']].map(([f, t]) => {
            const obj = r[f];
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
            const fields = Object.entries(obj).filter(([, v]) => safeString(v).trim()).map(([k, v]) => ({ label: humanizeKey(k), values: [safeString(v)] }));
            return fields.length ? section(t, fields, `${f}-${idx}`) : null;
          }).filter(Boolean);

          const valves = Array.isArray(r.valves) ? r.valves.map(safeString).filter((s) => s.trim()) : [];
          const valveSection = valves.length ? section('Valves', [{ label: 'Valves', showLabel: false, values: valves }], `v-${idx}`) : null;

          const sentSections = [['wallMotion', 'Wall Motion'], ['diastolicFunction', 'Diastolic Function'], ['pericardium', 'Pericardium'], ['conclusion', 'Conclusion']].map(([f, t]) => {
            const vals = splitBySentence(safeString(r[f]));
            return vals.length ? section(t, [{ label: t, showLabel: false, values: vals }], `${f}-${idx}`) : null;
          }).filter(Boolean);

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>{safeString(`Echo Report ${idx + 1}`)}</Text>
              {overview}
              {objSections}
              {valveSection}
              {sentSections}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default EchoReportsDocumentPDFTemplate;
