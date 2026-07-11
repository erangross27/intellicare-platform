/**
 * DiabetesManagementPlanDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: diabetes_management_plan.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel & subLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only; the section title rides INSIDE the first glue unit; every
 * sub-label glues with its first row. Every value row numbered ("1." even singles).
 * Mirrors the JSX exactly: [.;] sentence split with guarded comma sub-split, targetRanges keys
 * as ruled sub-labels (Day Target BG / Night Target BG / TIR / TBR), dynamic results recursion,
 * single-name mealPlan under its own section, epoch dates hidden.
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
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (val) => {
  if (!val) return '';
  const d = new Date(val.$date || val);
  if (Number.isNaN(d.getTime())) return String(val);
  if (d.getUTCFullYear() <= 1970) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

const OBJECT_KEY_LABELS = { dayTargetBG: 'Day Target BG', nightTargetBG: 'Night Target BG', TIR: 'TIR', TBR: 'TBR' };
const humanizeKey = (k) => {
  if (!k) return '';
  if (OBJECT_KEY_LABELS[k]) return OBJECT_KEY_LABELS[k];
  return String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()).trim();
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined || v === '') return true;
  if (typeof v === 'boolean' || typeof v === 'number') return false;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* Sentence rows mirroring the JSX/copy: labeled groups restart numbering under a sub-label;
   unlabeled comma lists (>=3 guarded parts) and plain sentences continue the running count. */
const sentenceRows = (text) => {
  const rows = []; let running = 1;
  splitBySentence(text).forEach(s => {
    const parsed = parseLabel(s);
    const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
    if (!value) return;
    const parts = splitByComma(value);
    if (parsed.isLabeled) {
      rows.push({ subLabel: parsed.label });
      if (parts.length >= 3) parts.forEach((item, i) => rows.push({ num: i + 1, text: item }));
      else rows.push({ num: 1, text: value });
    } else if (parts.length >= 3) {
      parts.forEach(item => rows.push({ num: running++, text: item }));
    } else {
      rows.push({ num: running++, text: value });
    }
  });
  return rows;
};

/* Recursive rows for dynamic objects: every key is a labeled sub-group. */
const objectRows = (obj) => {
  const rows = [];
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    rows.push({ subLabel: humanizeKey(k) });
    if (isScalar(v)) rows.push({ num: 1, text: fmtScalar(v) });
    else if (Array.isArray(v)) v.filter(x => !isEmptyDeep(x)).forEach((item, i) => rows.push({ num: i + 1, text: fmtScalar(item) }));
    else rows.push(...objectRows(v));
  });
  return rows;
};

/* Group rows into glue units: a sub-label glues with its first row; plain rows stand alone.
   The section title rides inside the FIRST unit. */
const RowsSection = ({ title, rows }) => {
  if (!rows || rows.length === 0) return null;
  const units = [];
  rows.forEach(r => {
    if (r.subLabel !== undefined) { units.push({ label: r.subLabel, rows: [] }); return; }
    const last = units[units.length - 1];
    if (last && last.label !== null && last.rows.length === 0) { last.rows.push(r); return; }
    units.push({ label: null, rows: [r] });
  });
  return (
    <View style={styles.section}>
      {units.map((u, i) => (
        <View key={i} wrap={false} style={styles.fieldGroup}>
          {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {u.label !== null && <Text style={styles.subLabel}>{safeString(u.label)}</Text>}
          {u.rows.map((r, ri) => <Text key={ri} style={styles.value}>{`${r.num}. ${safeString(r.text)}`}</Text>)}
        </View>
      ))}
    </View>
  );
};

const fieldRows = (label, lines) => {
  const out = [{ subLabel: label }];
  lines.forEach((l, i) => out.push({ num: i + 1, text: l }));
  return out;
};

/* ═══ COMPONENT ═══ */
const DiabetesManagementPlanDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.diabetes_management_plan) return Array.isArray(r.diabetes_management_plan) ? r.diabetes_management_plan : [r.diabetes_management_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetes_management_plan) return Array.isArray(dd.diabetes_management_plan) ? dd.diabetes_management_plan : [dd.diabetes_management_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Diabetes Management Plan">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Management Plan</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document title="Diabetes Management Plan">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diabetes Management Plan</Text></View>

        {records.map((record, idx) => {
          const overviewRows = [];
          const dv = formatDate(record.date);
          if (dv) overviewRows.push(...fieldRows('Date', [dv]));
          if (hasVal(record.provider)) overviewRows.push(...fieldRows('Provider', [fmtVal(record.provider)]));
          if (hasVal(record.facility)) overviewRows.push(...fieldRows('Facility', [fmtVal(record.facility)]));
          if (hasVal(record.status)) overviewRows.push(...fieldRows('Status', [fmtVal(record.status)]));

          const regimenRows = [];
          if (hasVal(record.insulinAdministration)) { regimenRows.push({ subLabel: 'Insulin Administration' }); sentenceRows(fmtVal(record.insulinAdministration)).forEach(r => regimenRows.push(r)); }
          if (hasVal(record.glucometerDownloadSchedule)) { regimenRows.push({ subLabel: 'Glucometer Download Schedule' }); sentenceRows(fmtVal(record.glucometerDownloadSchedule)).forEach(r => regimenRows.push(r)); }
          if (typeof record.carbohydrateCounting === 'boolean') regimenRows.push(...fieldRows('Carbohydrate Counting', [record.carbohydrateCounting ? 'Yes' : 'No']));
          if (hasVal(record.monitoringFrequency)) { regimenRows.push({ subLabel: 'Monitoring Frequency' }); sentenceRows(fmtVal(record.monitoringFrequency)).forEach(r => regimenRows.push(r)); }

          /* single-name: mealPlan rows render directly under the Meal Plan section title */
          const mealRows = hasVal(record.mealPlan) ? sentenceRows(fmtVal(record.mealPlan)) : [];

          const targetRows = [];
          if (record.targetRanges && typeof record.targetRanges === 'object' && !Array.isArray(record.targetRanges)) {
            Object.entries(record.targetRanges).filter(([, v]) => hasVal(v)).forEach(([k, v]) => targetRows.push(...fieldRows(humanizeKey(k), [fmtVal(v)])));
          }

          const clinicalRows = [];
          [['findings', 'Findings'], ['assessment', 'Assessment'], ['plan', 'Plan']].forEach(([f, label]) => {
            if (hasVal(record[f])) { clinicalRows.push({ subLabel: label }); sentenceRows(fmtVal(record[f])).forEach(r => clinicalRows.push(r)); }
          });
          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => hasVal(r)) : [];
          if (recs.length > 0) { clinicalRows.push({ subLabel: 'Recommendations' }); recs.forEach((r, i) => clinicalRows.push({ num: i + 1, text: String(r) })); }
          if (hasVal(record.notes)) { clinicalRows.push({ subLabel: 'Notes' }); sentenceRows(fmtVal(record.notes)).forEach(r => clinicalRows.push(r)); }

          const results = (record.results && typeof record.results === 'object' && !Array.isArray(record.results) && !isEmptyDeep(record.results)) ? record.results : null;

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Diabetes Management Plan ${idx + 1}`}</Text>
              </View>

              <RowsSection title="Plan Overview" rows={overviewRows} />
              <RowsSection title="Insulin & Monitoring" rows={regimenRows} />
              <RowsSection title="Meal Plan" rows={mealRows} />
              <RowsSection title="Target Ranges" rows={targetRows} />
              <RowsSection title="Findings, Assessment & Plan" rows={clinicalRows} />
              {results && <RowsSection title="Results" rows={objectRows(results)} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DiabetesManagementPlanDocumentPDFTemplate;
