/**
 * CgmDataDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom shoves the whole record → empty page 1);
 * per-FIELD gates with the section title inside the first field's unit + leaf glue (anti-orphan).
 * Collection: cgm_data
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/[;.]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
/* guarded comma split: never inside parentheses; ", and …"/", or …" stays connected; no-space commas kept */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
/* sentences → comma parts (mirrors the JSX rows) */
const sentenceParts = (text) => { const out = []; splitBySentence(String(text || '')).forEach(s => { splitByComma(s).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) out.push(t); }); }); return out; };

const FL = {
  deviceType: 'Device Type', dataPeriod: 'Data Period', sensorWearTime: 'Sensor Wear Time', readingsPerDay: 'Readings/Day',
  averageGlucose: 'Average Glucose', gmi: 'GMI', timeInRange: 'Time in Range', timeBelowRange: 'Time Below Range', timeAboveRange: 'Time Above Range', coefficientOfVariation: 'Coefficient of Variation',
  provider: 'Provider', facility: 'Facility', date: 'Date',
  findings: 'Findings', results: 'Results',
  assessment: 'Assessment', plan: 'Plan', notes: 'Notes', status: 'Status',
};
const SENTENCE_SPLIT_FIELDS = new Set(['findings', 'assessment', 'plan', 'notes']);
const KEY_OVERRIDES = { ef: 'EF', gmi: 'GMI', hba1c: 'HbA1c', id: 'ID' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

// single-name rule: field label == section title → the label is not repeated under the title
const showLbl = (f, sTitle) => (FL[f] || f).toLowerCase() !== String(sTitle).toLowerCase();

/* one field's inner content ("1." numbered values under an underlined label) */
const renderFieldInner = (record, f, sTitle) => {
  if (SENTENCE_SPLIT_FIELDS.has(f)) {
    const parts = sentenceParts(record[f]);
    return (
      <View style={{ marginBottom: 6 }}>
        {showLbl(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}
        {parts.map((s, si) => <Text key={si} style={styles.listItem}>{si + 1}. {s}</Text>)}
      </View>
    );
  }
  const displayVal = f === 'date' ? formatDate(record[f]) : fmtVal(record[f]);
  return (
    <View style={{ marginBottom: 6 }}>
      {showLbl(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}
      <Text style={styles.listItem}>1. {displayVal}</Text>
    </View>
  );
};

const fieldRowsOf = (record, f) => {
  if (SENTENCE_SPLIT_FIELDS.has(f)) return sentenceParts(record[f]).length + 1;
  return 2;
};

/* per-FIELD boolean gates; the section title rides inside the FIRST field's unit */
const renderFieldSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.section}>
      {visible.map((f, i) => {
        const rows = fieldRowsOf(record, f) + (i === 0 ? 1 : 0);
        return (
          <View key={f} wrap={rows > 8 ? true : false}>
            {i === 0 && <Text style={styles.sectionTitle}>{sTitle}</Text>}
            {renderFieldInner(record, f, sTitle)}
          </View>
        );
      })}
    </View>
  );
};

/* object rows: each leaf = its own wrap={false} glue unit (label + "1. value") */
const renderObjectRows = (value, depth) => {
  const entries = Object.entries(value || {}).filter(([, v]) => !isEmptyDeep(v));
  const rows = [];
  entries.forEach(([k, v]) => {
    if (isScalar(v)) {
      rows.push(
        <View key={`${depth}-${k}`} style={{ marginBottom: 6, marginLeft: depth * 12 }} wrap={false}>
          <Text style={styles.fieldLabel}>{humanizeKey(k)}</Text>
          <Text style={styles.listItem}>1. {fmtScalar(v)}</Text>
        </View>
      );
    } else {
      rows.push(<Text key={`${depth}-${k}-h`} style={[styles.fieldLabel, { marginLeft: depth * 12, marginTop: 2 }]}>{humanizeKey(k)}</Text>);
      rows.push(...renderObjectRows(v, depth + 1));
    }
  });
  return rows;
};

const countLeaves = (value) => { let n = 0; Object.values(value || {}).forEach(v => { if (isEmptyDeep(v)) return; if (isScalar(v)) n += 1; else n += countLeaves(v); }); return n; };

const renderObjectSection = (sTitle, value) => {
  if (!value || isScalar(value) || isEmptyDeep(value)) return null;
  const rows = renderObjectRows(value, 0);
  if (rows.length === 0) return null;
  const leaves = countLeaves(value);
  return (
    <View style={styles.section} wrap={leaves * 2 + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {rows}
    </View>
  );
};

const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  return (
    <View style={styles.section} wrap={arr.length + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {arr.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
    </View>
  );
};

const CgmDataDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cgm_data) return Array.isArray(r.cgm_data) ? r.cgm_data : [r.cgm_data];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cgm_data) return Array.isArray(dd.cgm_data) ? dd.cgm_data : [dd.cgm_data]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>CGM Data</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>CGM Data</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              {/* date renders in Provider Information — no duplicate here */}
              <Text style={styles.recordTitle}>{`CGM Data ${idx + 1}`}</Text>
            </View>
            {renderFieldSection('Device & Period', ['deviceType', 'dataPeriod', 'sensorWearTime', 'readingsPerDay'], record)}
            {renderFieldSection('Glucose Metrics', ['averageGlucose', 'gmi', 'timeInRange', 'timeBelowRange', 'timeAboveRange', 'coefficientOfVariation'], record)}
            {renderFieldSection('Provider Information', ['date', 'provider', 'facility'], record)}
            {renderFieldSection('Findings', ['findings'], record)}
            {renderObjectSection('Results', record.results)}
            {renderFieldSection('Assessment', ['assessment'], record)}
            {renderFieldSection('Plan', ['plan'], record)}
            {renderFieldSection('Notes', ['notes'], record)}
            {renderFieldSection('Status', ['status'], record)}
            {renderArraySection('Recommendations', record.recommendations)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CgmDataDocumentPDFTemplate;
