/**
 * DiagnosticStudiesDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: diagnostic_studies.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first field. Every value row numbered
 * ("1." even singles). break={idx>0} → one record per page. Mirrors the JSX exactly — single-name
 * fields (Findings/Recommendations) skip the sub-label, sentence fields (clinicalIndication/findings/
 * followUp) split by sentence + parseLabel, recommendations comma-split.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 6 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldGroup: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS (mirror the JSX) ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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

const DiagnosticStudiesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.diagnostic_studies) return Array.isArray(r.diagnostic_studies) ? r.diagnostic_studies : [r.diagnostic_studies];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diagnostic_studies) return Array.isArray(dd.diagnostic_studies) ? dd.diagnostic_studies : [dd.diagnostic_studies]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Diagnostic Studies">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diagnostic Studies</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  const sectionTitle = (t) => <Text style={styles.sectionTitle}>{t}</Text>;

  /* One field group: (title) + sub-label + 0.5pt rule + numbered value rows. wrap is boolean. */
  const fieldGroup = (label, values, key, withTitle) => {
    if (!values || values.length === 0) return null;
    return (
      <View key={key} style={styles.fieldGroup} wrap={values.length > 8}>
        {withTitle}
        {label ? <Text style={styles.fieldLabel}>{safeString(label)}</Text> : null}
        {values.map((v, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(v)}`}</Text>)}
      </View>
    );
  };

  /* Sentence field → numbered rows; a labeled sentence with >=2 comma items becomes a sub-label +
     numbered rows (continuous counter). label='' skips the field sub-label (single-name section). */
  const sentenceGroup = (label, text, key, withTitle) => {
    const sentences = splitBySentence(String(text));
    if (sentences.length === 0) return null;
    const rows = []; let n = 1;
    sentences.forEach((s, si) => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        rows.push(<Text key={`l-${si}`} style={styles.subLabel}>{`${safeString(parsed.label)}:`}</Text>);
        (parts.length >= 2 ? parts : [parsed.value]).forEach((it, ci) =>
          rows.push(<Text key={`v-${si}-${ci}`} style={styles.value}>{`${n++}. ${safeString(it)}`}</Text>));
      } else {
        rows.push(<Text key={`v-${si}`} style={styles.value}>{`${n++}. ${safeString(s)}`}</Text>);
      }
    });
    return (
      <View key={key} style={styles.fieldGroup} wrap={rows.length > 8}>
        {withTitle}
        {label ? <Text style={styles.fieldLabel}>{safeString(label)}</Text> : null}
        {rows}
      </View>
    );
  };

  const renderRecord = (record, idx) => {
    // ── Report Information ──
    const reportFields = [];
    if (hasVal(record.reportDate)) reportFields.push(['Report Date', [formatDate(record.reportDate)]]);
    if (hasVal(record.reportType)) reportFields.push(['Report Type', [fmtVal(record.reportType)]]);

    // ── Diagnostic Tests (hide empty) ──
    const testFields = [
      ['Vitamin B12', record.vitaminB12], ['Thyroid Function', record.thyroidFunction],
      ['Brain MRI', record.brainMRI], ['Orthostatic Vitals', record.orthostaticVitals], ['DaTscan', record.daTscan],
    ].filter(([, v]) => hasVal(v)).map(([l, v]) => [l, [fmtVal(v)]]);

    // ── Follow-Up ──
    const hasUrgency = hasVal(record.urgency);

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Diagnostic Study ${idx + 1}`}</Text>
        </View>

        {/* Report Information */}
        {(reportFields.length > 0 || hasVal(record.clinicalIndication)) && (
          <View style={styles.section}>
            {reportFields.map(([label, values], i) => fieldGroup(label, values, `ri-${i}`, i === 0 ? sectionTitle('Report Information') : null))}
            {hasVal(record.clinicalIndication) && sentenceGroup('Clinical Indication', record.clinicalIndication, 'ci', reportFields.length === 0 ? sectionTitle('Report Information') : null)}
          </View>
        )}

        {/* Diagnostic Tests */}
        {testFields.length > 0 && (
          <View style={styles.section}>
            {testFields.map(([label, values], i) => fieldGroup(label, values, `dt-${i}`, i === 0 ? sectionTitle('Diagnostic Tests') : null))}
          </View>
        )}

        {/* Findings — single-name (no field sub-label) */}
        {hasVal(record.findings) && (
          <View style={styles.section}>
            {sentenceGroup('', record.findings, 'fnd', sectionTitle('Findings'))}
          </View>
        )}

        {/* Recommendations — single-name comma-split */}
        {hasVal(record.recommendations) && (() => {
          const items = splitByComma(fmtVal(record.recommendations));
          return (
            <View style={styles.section}>
              {fieldGroup('', items, 'rec', sectionTitle('Recommendations'))}
            </View>
          );
        })()}

        {/* Follow-Up */}
        {(hasUrgency || hasVal(record.followUp)) && (
          <View style={styles.section}>
            {hasUrgency && fieldGroup('Urgency', [fmtVal(record.urgency)], 'urg', sectionTitle('Follow-Up'))}
            {hasVal(record.followUp) && sentenceGroup('Follow Up', record.followUp, 'fu', !hasUrgency ? sectionTitle('Follow-Up') : null)}
          </View>
        )}
      </View>
    );
  };

  return (
    <Document title="Diagnostic Studies">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diagnostic Studies</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DiagnosticStudiesDocumentPDFTemplate;
