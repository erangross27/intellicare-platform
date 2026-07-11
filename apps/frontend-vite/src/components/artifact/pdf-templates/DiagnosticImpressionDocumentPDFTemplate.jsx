/**
 * DiagnosticImpressionDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: diagnostic_impression.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first field. Every value row numbered
 * ("1." even singles). break={idx>0} → one record per page. Mirrors the JSX exactly — Session
 * Information as a proper section (no header "Date: X" meta), primaryDiagnosis icd10Code + specifiers,
 * diagnosis-array items show "(ICD)", findings/assessment/plan/notes sentence-split numbered.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

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

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean' || typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const numbered = text.split(/\s+(?=\d+\.\s)/).filter(s => s.trim()).map(s => s.trim());
  if (numbered.length > 1) return numbered;
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const formatKey = (key) => String(key || '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();
const flattenDynamicObject = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object') return [];
  const lines = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const label = prefix ? `${prefix} - ${formatKey(key)}` : formatKey(key);
    if (Array.isArray(value)) {
      const items = value.filter(v => v !== null && v !== undefined && v !== '');
      if (items.length === 0) return;
      lines.push({ label, value: items.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ') });
    } else if (typeof value === 'object') {
      const nested = flattenDynamicObject(value, label);
      if (nested.length > 0) lines.push(...nested);
    } else {
      lines.push({ label, value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) });
    }
  });
  return lines;
};

const DiagnosticImpressionDocumentPDFTemplate = ({ document: records }) => {
  const validRecords = (Array.isArray(records) ? records : [records]).filter(r => r && typeof r === 'object');

  if (validRecords.length === 0) {
    return (
      <Document title="Diagnostic Impression">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diagnostic Impression</Text></View>
          <Text style={styles.emptyState}>No diagnostic impression records available</Text>
        </Page>
      </Document>
    );
  }

  /* One field group: sub-label + 0.5pt rule + numbered value rows (wrap is boolean, Rule #74). */
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
     its own numbered rows (continuous counter). Mirrors formatSentenceFieldLines in the JSX. */
  const renderSentenceGroup = (label, text, key, useParseLab, withTitle) => {
    const sentences = splitBySentence(String(text));
    if (sentences.length === 0) return null;
    const rows = [];
    let n = 1;
    sentences.forEach((s, si) => {
      const parsed = useParseLab ? parseLabel(s) : { isLabeled: false, value: s };
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
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        {rows}
      </View>
    );
  };

  const renderRecord = (record, idx) => {
    const sectionTitle = (t) => <Text style={styles.sectionTitle}>{t}</Text>;

    // ── Session Information ──
    const sessionFields = [];
    if (hasVal(record.date)) sessionFields.push(['Date', [formatDate(record.date)]]);
    if (hasVal(record.type)) sessionFields.push(['Type', [fmtVal(record.type)]]);
    if (hasVal(record.provider)) sessionFields.push(['Provider', [fmtVal(record.provider)]]);
    if (hasVal(record.facility)) sessionFields.push(['Facility', (Array.isArray(record.facility) ? record.facility : [record.facility]).filter(hasVal).map(fmtVal)]);
    if (hasVal(record.status)) sessionFields.push(['Status', [fmtVal(record.status)]]);

    // ── Primary Diagnosis ──
    const pd = record.primaryDiagnosis || {};
    const primaryFields = [];
    if (hasVal(pd.diagnosis)) primaryFields.push(['Diagnosis', [fmtVal(pd.diagnosis)]]);
    if (hasVal(pd.icd10Code)) primaryFields.push(['ICD-10 Code', [fmtVal(pd.icd10Code)]]);
    if (hasVal(pd.severity)) primaryFields.push(['Severity', [fmtVal(pd.severity)]]);
    if (hasVal(pd.specifiers)) primaryFields.push(['Specifiers', (Array.isArray(pd.specifiers) ? pd.specifiers : [pd.specifiers]).filter(hasVal).map(fmtVal)]);

    // ── Diagnosis arrays (single-name: numbered "diagnosis (ICD)" rows, no sub-label) ──
    const diagArray = (arr) => (arr || []).map(item => {
      const diag = typeof item === 'object' ? item.diagnosis : item;
      const icd = (item && typeof item === 'object') ? item.icd10Code : '';
      return `${safeString(diag)}${icd ? ` (${icd})` : ''}`;
    }).filter(v => v.trim());

    const differential = diagArray(record.differentialDiagnoses);
    const comorbidities = diagArray(record.comorbidities);
    const provisional = diagArray(record.provisionalDiagnoses);
    const ruleOut = diagArray(record.ruleOutDiagnoses);

    // ── Recommendations ──
    const recs = Array.isArray(record.recommendations) ? record.recommendations : [];
    const recDates = [...new Set(recs.filter(r => r && r.date).map(r => formatDate(r.date)))];
    const recTexts = recs.map(item => fmtVal(item && typeof item === 'object' ? (item.recommendation || '') : item)).filter(v => v.trim());

    // ── Test Results ──
    const resultLines = (record.results && typeof record.results === 'object') ? flattenDynamicObject(record.results) : [];

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Diagnostic Impression ${idx + 1}`}</Text>
        </View>

        {/* Session Information */}
        {sessionFields.length > 0 && (
          <View style={styles.section}>
            {sessionFields.map(([label, values], i) => fieldGroup(label, values, `si-${i}`, i === 0 ? sectionTitle('Session Information') : null))}
          </View>
        )}

        {/* Primary Diagnosis */}
        {primaryFields.length > 0 && (
          <View style={styles.section}>
            {primaryFields.map(([label, values], i) => fieldGroup(label, values, `pd-${i}`, i === 0 ? sectionTitle('Primary Diagnosis') : null))}
          </View>
        )}

        {/* Differential / Comorbidities / Provisional / Rule Out — single-name numbered rows */}
        {differential.length > 0 && <View style={styles.section}>{fieldGroup('', differential, 'dd', sectionTitle('Differential Diagnoses'))}</View>}
        {comorbidities.length > 0 && <View style={styles.section}>{fieldGroup('', comorbidities, 'cm', sectionTitle('Comorbidities'))}</View>}
        {provisional.length > 0 && <View style={styles.section}>{fieldGroup('', provisional, 'pv', sectionTitle('Provisional Diagnoses'))}</View>}
        {ruleOut.length > 0 && <View style={styles.section}>{fieldGroup('', ruleOut, 'ro', sectionTitle('Rule Out Diagnoses'))}</View>}

        {/* Clinical Findings — single-name sentence field */}
        {hasVal(record.findings) && (
          <View style={styles.section}>
            {renderSentenceGroup('Clinical Findings', record.findings, 'find', true, sectionTitle('Clinical Findings'))}
          </View>
        )}

        {/* Assessment */}
        {hasVal(record.assessment) && (
          <View style={styles.section}>
            {renderSentenceGroup('Assessment', record.assessment, 'ass', false, sectionTitle('Assessment'))}
          </View>
        )}

        {/* Plan */}
        {hasVal(record.plan) && (
          <View style={styles.section}>
            {renderSentenceGroup('Plan', record.plan, 'plan', false, sectionTitle('Plan'))}
          </View>
        )}

        {/* Recommendations — Date sub-label + numbered recs */}
        {recTexts.length > 0 && (
          <View style={styles.section} wrap={recTexts.length > 8}>
            {sectionTitle('Recommendations')}
            {recDates.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Date</Text>
                {recDates.map((d, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(d)}`}</Text>)}
              </>
            )}
            {recTexts.map((r, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(r)}`}</Text>)}
          </View>
        )}

        {/* Test Results */}
        {resultLines.length > 0 && (
          <View style={styles.section}>
            {resultLines.map((line, i) => fieldGroup(line.label, [line.value], `res-${i}`, i === 0 ? sectionTitle('Test Results') : null))}
          </View>
        )}

        {/* Notes — sentence field */}
        {hasVal(record.notes) && (
          <View style={styles.section}>
            {renderSentenceGroup('Notes', record.notes, 'notes', true, sectionTitle('Notes'))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Document title="Diagnostic Impression">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diagnostic Impression</Text></View>
        {validRecords.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DiagnosticImpressionDocumentPDFTemplate;
